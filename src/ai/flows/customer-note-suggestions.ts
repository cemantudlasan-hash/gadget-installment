//CustomerNoteSuggestions.ts
'use server';
/**
 * @fileOverview An AI agent that suggests customer notes or reminders, especially if the customer's passport ID is abnormal.
 *
 * - suggestCustomerNote - A function that generates a customer note suggestion.
 * - SuggestCustomerNoteInput - The input type for the suggestCustomerNote function.
 * - SuggestCustomerNoteOutput - The return type for the suggestCustomerNote function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestCustomerNoteInputSchema = z.object({
  passportID: z.string().describe('The customer\u0027s passport ID.'),
});
export type SuggestCustomerNoteInput = z.infer<typeof SuggestCustomerNoteInputSchema>;

const SuggestCustomerNoteOutputSchema = z.object({
  note: z.string().describe('A suggested note or reminder for the customer.'),
});
export type SuggestCustomerNoteOutput = z.infer<typeof SuggestCustomerNoteOutputSchema>;

export async function suggestCustomerNote(input: SuggestCustomerNoteInput): Promise<SuggestCustomerNoteOutput> {
  return suggestCustomerNoteFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestCustomerNotePrompt',
  input: {schema: SuggestCustomerNoteInputSchema},
  output: {schema: SuggestCustomerNoteOutputSchema},
  prompt: `You are a helpful assistant that suggests customer notes for salespeople.

  If the passport ID looks unusual or abnormal, generate a reminder to double-check the ID.

  Passport ID: {{{passportID}}}
  `,
});

const suggestCustomerNoteFlow = ai.defineFlow(
  {
    name: 'suggestCustomerNoteFlow',
    inputSchema: SuggestCustomerNoteInputSchema,
    outputSchema: SuggestCustomerNoteOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
