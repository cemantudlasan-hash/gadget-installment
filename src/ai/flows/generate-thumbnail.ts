'use server';
/**
 * @fileOverview A Genkit flow for generating product thumbnails and uploading to Firebase Storage.
 *
 * - generateThumbnail - Generates an image for a given product name and uploads it.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/lib/firebase/config';
import { v4 as uuidv4 } from 'uuid';

// Initialize Firebase outside the flow to avoid re-initialization on every call
const apps = getApps();
const firebaseApp = apps.length ? apps[0] : initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);

const GenerateThumbnailInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
});

const GenerateThumbnailOutputSchema = z.object({
  imageUrl: z.string().describe('The public URL of the generated and uploaded image.'),
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

    // 2. Upload the image to Firebase Storage
    const dataUrl = media.url; // This is a base64 data URI
    const fileExtension = dataUrl.substring(dataUrl.indexOf('/') + 1, dataUrl.indexOf(';'));
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;
    const storageRef = ref(storage, `thumbnails/${uniqueFilename}`);
    
    // The data URL needs to be stripped of its prefix to get the pure base64 data
    const base64Data = dataUrl.split(',')[1];
    
    await uploadString(storageRef, base64Data, 'base64');
    
    // 3. Get the public download URL
    const downloadURL = await getDownloadURL(storageRef);

    // 4. Return the public URL
    return { imageUrl: downloadURL };
  }
);
