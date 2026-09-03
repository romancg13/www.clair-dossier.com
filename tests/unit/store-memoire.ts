/**
 * Store en mémoire pour tester un agent sans base de données : un document, ses
 * pages et ses chunks (découpés réellement), et l'enregistrement de tout ce que
 * l'agent tente d'écrire.
 */
import { decouperDocument } from '../../supabase/functions/_shared/pipeline/decoupage.ts';
import type { Chunk, DocumentIngestion, PageTexte, Store, Travail } from '../../supabase/functions/_shared/pipeline/types.ts';

export const DOSSIER_ID = '11111111-1111-4111-8111-111111111111';
export const TENANT_ID = '22222222-2222-4222-8222-222222222222';
export const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333';
export const TRACE_ID = '44444444-4444-4444-8444-444444444444';

export type Journal = {
  entites: unknown[][];
  evenements: unknown[][];
  classifications: { categorie: string; confiance: number; nomNormalise: string | null; quasi: string | null; similarite: number | null }[];
  controles: { runId: string; sentinelRunId: string | null; verdict: string; iterations: number }[];
  runs: { id: string; agent: string; statut?: string; sortie?: unknown; erreur?: string | null }[];
  statuts: string[];
};

export function storeMemoire(pagesTexte: string[], options: { statut?: string; fileName?: string; type?: string } = {}): { store: Store; journal: Journal; travail: Travail } {
  const pages: PageTexte[] = pagesTexte.map((texte, i) => ({ page: i + 1, texte, methode: texte.trim() ? 'natif' : 'ocr_requis' }));
  const chunks: (Chunk & { id: string })[] = decouperDocument(pages.filter((p) => p.methode === 'natif')).map((c, i) => ({
    ...c,
    id: `55555555-5555-4555-8555-${String(i + 1).padStart(12, '0')}`,
  }));
  const doc: DocumentIngestion = {
    id: DOCUMENT_ID, tenant_id: TENANT_ID, dossier_id: DOSSIER_ID, file_path: 'u/d/piece.pdf', file_name: options.fileName ?? 'piece.pdf',
    size_bytes: 10, mime: 'application/pdf', hash_sha256: 'a'.repeat(64), kind: 'piece', statut_ingestion: options.statut ?? 'vectorise',
    doublon_de_id: null, supprime_le: null,
  };
  const journal: Journal = { entites: [], evenements: [], classifications: [], controles: [], runs: [], statuts: [] };
  const store: Store = {
    async prendreTravail() { return null; },
    async terminerTravail() {},
    async echouerTravail() {},
    async lireDocument(id) { return id === DOCUMENT_ID ? doc : null; },
    async verifierQuota() { return { ok: true }; },
    async enregistrerEmpreinte() {},
    async enregistrerPages() {},
    async marquerIngestion(_id, statut) { journal.statuts.push(statut); doc.statut_ingestion = statut; },
    async demarrerRun(agent) {
      const id = `66666666-6666-4666-8666-${String(journal.runs.length + 1).padStart(12, '0')}`;
      journal.runs.push({ id, agent });
      return id;
    },
    async terminerRun(runId, statut, sortie, _confiance, _duree, erreur) {
      const r = journal.runs.find((x) => x.id === runId);
      if (r) { r.statut = statut; r.sortie = sortie; r.erreur = erreur; }
    },
    async lireDocumentPages() { return pages; },
    async enregistrerChunks() {},
    async rechercherChunks() { return []; },
    async lireChunks() { return chunks; },
    async enregistrerEntites(_d, entites) { journal.entites.push(entites); return entites.map(() => ({ entite_id: 'x', verrouillee: false, creee: true })); },
    async enregistrerEvenements(_d, evenements) { journal.evenements.push(evenements); return evenements.map(() => ({ evenement_id: 'y', verrouillee: false, creee: true })); },
    async lireDocumentsDossier() {
      return [{ id: DOCUMENT_ID, file_name: doc.file_name, kind: 'piece', statut_ingestion: doc.statut_ingestion, categorie: null, confiance_classification: null, pages: pages.length, supprime_le: null, created_at: '2026-09-03T00:00:00Z' }];
    },
    async enregistrerClassification(_id, categorie, confiance, nomNormalise, quasi, similarite) {
      journal.classifications.push({ categorie, confiance, nomNormalise, quasi, similarite });
      return { categorie_appliquee: true, categorie_humaine: false };
    },
    async enregistrerControle(runId, sentinelRunId, verdict, iterations) {
      journal.controles.push({ runId, sentinelRunId, verdict, iterations });
    },
  };
  const travail: Travail = {
    id: 1, tenant_id: TENANT_ID, dossier_id: DOSSIER_ID, document_id: DOCUMENT_ID, type: options.type ?? 'veritas', charge: {}, priorite: 5,
    tentatives: 1, max_tentatives: 3, trace_id: TRACE_ID,
  };
  return { store, journal, travail };
}
