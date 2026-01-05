
'use server';
/**
 * @fileOverview A Genkit flow for generating product thumbnails.
 *
 * - generateThumbnail - Generates an image for a given product name.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateThumbnailInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
});

const GenerateThumbnailOutputSchema = z.object({
  imageUrl: z.string().describe('The base64 data URI of the generated image.'),
});

export async function generateThumbnail(
  input: z.infer<typeof GenerateThumbnailInputSchema>
): Promise<z.infer<typeof GenerateThumbnailOutputSchema>> {
  return generateThumbnailFlow(input);
}

const generateThumbnailFlow = ai.defineFlow(
  {
    name: 'generateThumbnailFlow',
    inputSchema: GenerateThumbnailInputSchema,
    outputSchema: GenerateThumbnailOutputSchema,
  },
  async ({ productName }) => {
    // 1. Generate the image using the AI model
    const { media } = await ai.generate({
      model: 'googleai/imagen-4.0-fast-generate-001',
      prompt: `Generate a clean, professional product photograph of a "${productName}" on a plain white background. The image should be suitable for an e-commerce website thumbnail.`,
    });
    
    if (!media || !media.url) {
      throw new Error('Image generation failed to return image data.');
    }
    
    // 2. Return the base64 data URI directly
    return { imageUrl: media.url };
  }
);
