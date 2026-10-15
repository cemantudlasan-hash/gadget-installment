'use server';
/**
 * @fileOverview A Genkit flow for generating product thumbnails.
 *
 * - generateThumbnail - Generates an accurate, isolated image with no background for a given product.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const GenerateThumbnailInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  category: z.string().optional().describe('The category of the product.'),
  description: z.string().optional().describe('Additional specs and details of the product.'),
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
  async ({ productName, category, description }) => {
    const categoryInfo = category ? ` in the category "${category}"` : '';
    const details = description ? `. Product details: "${description}"` : '';

    // Generate accurate device shot on pure solid black background with no background elements
    const { media } = await ai.generate({
      model: 'googleai/imagen-4.0-fast-generate-001',
      prompt: `A highly accurate, authentic commercial product photograph of "${productName}"${categoryInfo}${details}. The device must be isolated on a pure solid black background (#000000) with no background props, no pedestal, no clutter. Clean studio lighting, hyper-realistic, exact device model and colors, sharp angles, professional transparent cutout e-commerce style.`,
    });
    
    if (!media || !media.url) {
      throw new Error('Image generation failed to return image data.');
    }
    
    return { imageUrl: media.url };
  }
);
