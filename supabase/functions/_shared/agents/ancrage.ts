/**
 * Vérification d'ancrage : une source citée par un agent n'est acceptée que si
 * l'extrait se trouve littéralement (aux blancs près) dans la page indiquée du
 * document indiqué, et qu'un chunk réel la contient. Sinon l'assertion est
 * rejetée : elle n'est jamais persistée (F2, I2). SENTINEL (étape 11) reprend ce
 * contrôle a posteriori sur toute sortie.
 */
import type { SourceAssertion } from "../schema/validateur.ts";

export type ChunkConnu = { id: string; document_id: string; page: number; offset_debut: number; offset_fin: number };
export type PageConnue = { document_id: string; page: number; texte: string };

export type SourceResolue = {
  chunk_id: string;
  document_id: string;
  page: number;
  extrait: string;
  offset_debut: number;
  offset_fin: number;
};

export type Resolution =
  | { ok: true; source: SourceResolue }
  | { ok: false; motif: "document_inconnu" | "page_inconnue" | "extrait_absent" | "chunk_absent" | "extrait_trop_court" };

const MIN_EXTRAIT = 8;

function blancs(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}

/** Position de `extrait` dans `texte`, tolérante aux blancs ; -1 si absente. */
export function localiser(texte: string, extrait: string): { debut: number; fin: number } | null {
  const cible = blancs(extrait);
  if (cible.length < MIN_EXTRAIT) return null;
  const direct = texte.indexOf(cible);
  if (direct >= 0) return { debut: direct, fin: direct + cible.length };
  // Comparaison sur une version repliée, avec table de correspondance des positions.
  const positions: number[] = [];
  let replie = "";
  let dernierBlanc = true;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (/\s/.test(c)) {
      if (!dernierBlanc) {
        replie += " ";
        positions.push(i);
      }
      dernierBlanc = true;
    } else {
      replie += c;
      positions.push(i);
      dernierBlanc = false;
    }
  }
  const idx = replie.indexOf(cible);
  if (idx < 0) return null;
  return { debut: positions[idx], fin: positions[idx + cible.length - 1] + 1 };
}

export function resoudreSource(source: SourceAssertion, pages: PageConnue[], chunks: ChunkConnu[]): Resolution {
  if (blancs(source.extrait).length < MIN_EXTRAIT) return { ok: false, motif: "extrait_trop_court" };
  if (!pages.some((p) => p.document_id === source.document_id)) return { ok: false, motif: "document_inconnu" };
  const page = pages.find((p) => p.document_id === source.document_id && p.page === source.page);
  if (!page) return { ok: false, motif: "page_inconnue" };
  const pos = localiser(page.texte, source.extrait);
  if (!pos) return { ok: false, motif: "extrait_absent" };
  const chunk = chunks.find(
    (c) => c.document_id === source.document_id && c.page === source.page && c.offset_debut <= pos.debut && pos.debut < c.offset_fin,
  );
  if (!chunk) return { ok: false, motif: "chunk_absent" };
  return {
    ok: true,
    source: {
      chunk_id: chunk.id,
      document_id: source.document_id,
      page: source.page,
      extrait: page.texte.slice(pos.debut, pos.fin),
      offset_debut: pos.debut,
      offset_fin: pos.fin,
    },
  };
}
