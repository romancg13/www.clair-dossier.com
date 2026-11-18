// Ressources des rendus PDF (polices du site, logo officiel). Sous Node, lues
// sur disque ; dans le paquet Vercel, ce module est remplacé à la construction
// par les mêmes octets incorporés (scripts/recette/vercel-build.mjs).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PdfAssets } from '../../supabase/functions/_shared/rendus/index.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const ASSET_FILES = {
  body: 'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff',
  bold: 'node_modules/@fontsource/inter/files/inter-latin-600-normal.woff',
  title: 'node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff',
  logo: 'docs/marque/logo-horizontal-clair.png',
} as const;

let cache: PdfAssets | null = null;
export function loadAssets(): PdfAssets {
  cache ??= Object.fromEntries(Object.entries(ASSET_FILES).map(([k, f]) => [k, new Uint8Array(readFileSync(root + f))])) as unknown as PdfAssets;
  return cache;
}
