'use server';
/**
 * @fileOverview An AI flow to translate guest inquiries if they are not in English.
 *
 * - translateInquiry - Detects the language of a message and translates it to English if needed.
 * - TranslateInquiryInput - The input type for the translateInquiry function.
 * - TranslateInquiryOutput - The return type for the translateInquiry function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const TranslateInquiryInputSchema = z.object({
  message: z.string().describe('The guest inquiry message.'),
});
export type TranslateInquiryInput = z.infer<
  typeof TranslateInquiryInputSchema
>;

const TranslateInquiryOutputSchema = z.object({
  language: z.string().describe('The detected two-letter language code (e.g., "en", "th").'),
  translation: z.string().optional().describe('The English translation, if the original message was not in English.'),
});
export type TranslateInquiryOutput = z.infer<
  typeof TranslateInquiryOutputSchema
>;

export async function translateInquiry(
  input: TranslateInquiryInput
): Promise<TranslateInquiryOutput> {
  return translateInquiryFlow(input);
}

const languageDetectionPrompt = ai.definePrompt({
    name: 'languageDetectionPrompt',
    input: { schema: TranslateInquiryInputSchema },
    prompt: `Detect the language of the following text and return only the two-letter ISO 639-1 code (e.g., "en" for English, "th" for Thai).

    Text: "{{{message}}}"
    
    Language code:`,
    config: {
        temperature: 0,
    }
});

const translationToEnglishPrompt = ai.definePrompt({
    name: 'translationToEnglishPrompt',
    input: { schema: TranslateInquiryInputSchema },
    prompt: `Translate the following text to English:

    Text: "{{{message}}}"
    
    Translation:`,
});

const translateInquiryFlow = ai.defineFlow(
  {
    name: 'translateInquiryFlow',
    inputSchema: TranslateInquiryInputSchema,
    outputSchema: TranslateInquiryOutputSchema,
  },
  async ({ message }) => {
    const langResponse = await languageDetectionPrompt({ message });
    const language = langResponse.text.trim().toLowerCase();

    if (language === 'en' || language === '') {
        return { language: 'en' };
    }
    
    const translationResponse = await translationToEnglishPrompt({ message });
    const translation = translationResponse.text;

    return {
      language,
      translation,
    };
  }
);
