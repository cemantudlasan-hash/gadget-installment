'use server';
/**
 * @fileOverview A video generation AI agent.
 *
 * - generateVideo - A function that handles the video generation process.
 * - GenerateVideoInput - The input type for the generateVideo function.
 * - GenerateVideoOutput - The return type for the generateVideo function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { Readable } from 'stream';
import { MediaPart } from 'genkit';


const GenerateVideoInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo to animate, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  prompt: z.string().describe('A text prompt describing the desired animation.'),
});
export type GenerateVideoInput = z.infer<typeof GenerateVideoInputSchema>;

const GenerateVideoOutputSchema = z.object({
  videoDataUri: z.string().describe('The generated video as a data URI.'),
});
export type GenerateVideoOutput = z.infer<typeof GenerateVideoOutputSchema>;

export async function generateVideo(
  input: GenerateVideoInput
): Promise<GenerateVideoOutput> {
  return generateVideoFlow(input);
}

const generateVideoFlow = ai.defineFlow(
  {
    name: 'generateVideoFlow',
    inputSchema: GenerateVideoInputSchema,
    outputSchema: GenerateVideoOutputSchema,
  },
  async ({ photoDataUri, prompt }) => {
    // The model requires the mimeType and the base64 data to be separated.
    const match = photoDataUri.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
      throw new Error('Invalid photoDataUri format.');
    }
    const mimeType = match[1];
    const base64Data = match[2];

    let { operation } = await ai.generate({
      model: 'googleai/veo-2.0-generate-001',
      prompt: [
        {
          media: {
            contentType: mimeType,
            url: `data:${mimeType};base64,${base64Data}`,
          },
        },
        { text: prompt },
      ],
      config: {
        durationSeconds: 5,
        aspectRatio: '9:16',
        personGeneration: 'allow_adult',
      },
    });

    if (!operation) {
      throw new Error('Expected the model to return an operation');
    }

    // Wait for the operation to complete. This can take some time.
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.checkOperation(operation);
    }

    if (operation.error) {
      throw new Error('failed to generate video: ' + operation.error.message);
    }
    
    const videoPart = operation.output?.message?.content.find(p => !!p.media);
    if (!videoPart || !videoPart.media) {
      throw new Error('Failed to find the generated video');
    }

    const fetch = (await import('node-fetch')).default;
    const apiKey = process.env.GEMINI_API_KEY;
    // The media URL from the AI service might not include the API key, so we add it.
    const videoUrl = `${videoPart.media.url}${apiKey ? `&key=${apiKey}` : ''}`;
    
    const videoDownloadResponse = await fetch(videoUrl);

    if (!videoDownloadResponse.ok || !videoDownloadResponse.body) {
      throw new Error(
        `Failed to fetch video: ${videoDownloadResponse.statusText}`
      );
    }

    const responseBuffer = await videoDownloadResponse.arrayBuffer();
    const videoBuffer = Buffer.from(responseBuffer);
    const base64Video = videoBuffer.toString('base64');

    return {
      // Return the video as a data URI that can be used directly in the <video> tag.
      videoDataUri: `data:video/mp4;base64,${base64Video}`,
    };
  }
);
