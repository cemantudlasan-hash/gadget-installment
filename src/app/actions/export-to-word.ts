'use server';

import { saveAs } from 'file-saver';
import htmlToDocx from 'html-to-docx';

export async function exportToWord(htmlString: string): Promise<Buffer | null> {
  try {
    const fileBuffer = await htmlToDocx(htmlString, undefined, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
    });
    
    return fileBuffer as Buffer;
  } catch (error) {
    console.error('Error generating DOCX:', error);
    return null;
  }
}
