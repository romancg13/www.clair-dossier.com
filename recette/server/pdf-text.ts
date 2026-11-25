// Texte par page d'un PDF (pdf.js sans navigateur, via unpdf). Utilisé par
// l'adaptateur de recette et les tests ; le worker Supabase peut injecter
// l'équivalent Deno sans changer le cœur.
import { extractText, getDocumentProxy } from 'unpdf';

export async function pdfText(bytes: Uint8Array): Promise<string[]> {
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  try {
    const r = await extractText(doc, { mergePages: false });
    return (Array.isArray(r.text) ? r.text : [r.text]).map((t) => String(t));
  } finally {
    const d = doc as unknown as { destroy?: () => Promise<void> };
    if (typeof d.destroy === 'function') await d.destroy().catch(() => undefined);
  }
}
