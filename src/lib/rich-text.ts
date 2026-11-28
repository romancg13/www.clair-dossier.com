/**
 * Découpe « **gras** » en segments à rendre en React. Tout autre balisage
 * reste du texte brut : aucun HTML n'est jamais interprété.
 */
export function boldSegments(text: string): { text: string; bold: boolean }[] {
  return text
    .split(/\*\*(\S(?:[^*\n]*\S)?)\*\*/g)
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((s) => s.text);
}
