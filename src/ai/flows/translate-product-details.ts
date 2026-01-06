'use server';
/**
 * @fileOverview An AI flow to translate product details into Thai.
 *
 * - translateProductDetails - Translates product name and description.
 * - TranslateProductDetailsInput - The input type for the function.
 * - TranslateProductDetailsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const TranslateProductDetailsInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  description: z.string().describe('The description of the product.'),
});
export type TranslateProductDetailsInput = z.infer<
  typeof TranslateProductDetailsInputSchema
>;

const TranslateProductDetailsOutputSchema = z.object({
  translatedName: z.string().describe('The Thai translation of the product name.'),
  translatedDescription: z.string().describe('The Thai translation of the product description.'),
});
export type TranslateProductDetailsOutput = z.infer<
  typeof TranslateProductDetailsOutputSchema
>;

export async function translateProductDetails(
  input: TranslateProductDetailsInput
): Promise<TranslateProductDetailsOutput> {
  return translateProductDetailsFlow(input);
}

const translationPrompt = ai.definePrompt({
    name: 'translateProductToThaiPrompt',
    input: { schema: TranslateProductDetailsInputSchema },
    output: { schema: TranslateProductDetailsOutputSchema },
    prompt: `Translate the following product name and description to Thai.

    Product Name: {{{productName}}}
    Description: {{{description}}}
    `,
});


const translateProductDetailsFlow = ai.defineFlow(
  {
    name: 'translateProductDetailsFlow',
    inputSchema: TranslateProductDetailsInputSchema,
    outputSchema: TranslateProductDetailsOutputSchema,
  },
  async (input) => {
    const { output } = await translationPrompt(input);
    return output!;
  }
);
