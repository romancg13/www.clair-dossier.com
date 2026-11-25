// Diagnostic de latence « dépôt de 4 pièces → premier résultat » sur la pile de recette EN MÉMOIRE, avec une
// latence simulée par accès au stockage (reproduction locale de Vercel Blob). Aucun réseau, aucun modèle.
// Usage : npx tsx scripts/recette/latence.ts [--min=60] [--max=120] [--ecriture=250-450] [--sondage=4000|adaptatif] [--json]
// --min/--max : latence de chaque accès ; --ecriture : latence propre aux écritures et aux listes (sinon la même).
// Le client simulé suit src/recette/DossierPage.tsx : 4 envois en parallèle (un fichier par requête), puis
// consultation du dossier et sondage tant que le dossier est « en cours ».
import { readFileSync } from 'node:fs';
import { pause, pileMesure } from './lib/pile-mesure.ts';
import type { Nature } from './lib/kv-mesure.ts';
import type { EngineConfig } from '../../supabase/functions/_shared/engine/ports.ts';
import { delaiSondage } from '../../src/recette/suivi.ts';

const arg = (n: string, d: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1] ?? d;
const minMs = Number(arg('min', '60'));
const maxMs = Number(arg('max', '120'));
const sondage = arg('sondage', 'adaptatif');
const PIECES = ['Courrier-bailleur-2026-10-12.pdf', 'Avis-echeance-T4-2026.pdf', 'Releve-charges-2025.xlsx', 'Courriel-2026-10-20.eml'];
const fixture = (n: string) => new Uint8Array(readFileSync(new URL(`../../recette/fixtures/pieces/${encodeURIComponent(n)}`, import.meta.url)));

export async function mesurerLatence(o: { minMs: number; maxMs: number; ecriture?: { minMs: number; maxMs: number }; sondage: string; config?: Partial<EngineConfig> }) {
  const pile = pileMesure({ latence: null, config: o.config });
  const c = pile.client();
  await c.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const id = (await c.json('GET', '/api/dossiers')).dossiers[0].id as string;
  await pile.repos();
  pile.kv.raz();
  pile.kv.latence = { minMs: o.minMs, maxMs: o.maxMs, ecriture: o.ecriture };

  const t0 = Date.now();
  const depuis = () => Date.now() - t0;
  const jalons: Record<string, number> = {};
  const jalon = (k: string) => (jalons[k] ??= depuis());
  const parPrefixe: Record<string, number> = {};
  let extractions = 0;
  pile.kv.onAcces = (nature: Nature, cle: string) => {
    const p = `${nature}:${cle.split(/[/.]/)[0]}`;
    parPrefixe[p] = (parPrefixe[p] ?? 0) + 1;
    if (nature === 'ecriture' && cle.startsWith('extractions/')) {
      jalon('serveur_premiere_piece_lue');
      if (++extractions === PIECES.length) jalon('serveur_toutes_pieces_lues');
    }
    if (nature === 'ecriture' && /^analyses\/.*\/r\d+\.json$/.test(cle)) jalon('serveur_analyse_enregistree');
    if (nature === 'octetsEcrits' && cle.startsWith('out/')) jalon('serveur_premier_rendu_ecrit');
    if (nature === 'ecriture' && cle.startsWith('views/')) jalon('serveur_vue_publiee');
  };
  // Trace facultative des travaux (--trace) : instant, clé, statut, échéance — jamais de contenu de pièce.
  const trace: string[] = [];
  if (process.argv.includes('--trace')) {
    const put = pile.kv.inner.putJson.bind(pile.kv.inner);
    pile.kv.inner.putJson = async (key, value, opts) => {
      const r = await put(key, value, opts);
      const j = value as { key?: string; status?: string; run_after?: string; rerun?: boolean; attempts?: number };
      if (key.startsWith('jobs/') && r.ok) trace.push(`${depuis()} ${j.key?.slice(0, 12)} ${j.status}${j.rerun ? ' +relance' : ''} essai=${j.attempts} dans=${Math.max(0, Date.parse(j.run_after ?? '') - Date.now())}ms`);
      return r;
    };
  }
  // Temps pendant lequel AUCUN accès au stockage n'est en vol (attentes fixes, calcul) : échantillonné toutes les 10 ms.
  let inactif = 0;
  let dernier = Date.now();
  const sonde = setInterval(() => {
    const t = Date.now();
    if (pile.kv.enVol === 0 && !jalons.serveur_vue_publiee && jalons.depot_termine !== undefined) inactif += Math.min(50, t - dernier);
    dernier = t;
  }, 10);

  // Dépôt : 4 requêtes en parallèle, un fichier par requête (comme l'interface).
  const lot = crypto.randomUUID();
  await Promise.all(
    PIECES.map(async (n) => {
      const f = new FormData();
      f.append('lot', lot);
      f.append('total', String(PIECES.length));
      f.append('fichiers', new File([fixture(n)], n));
      const r = await c.call('POST', `/api/dossiers/${id}/pieces`, f);
      if (r.status !== 201) throw new Error(`dépôt refusé (${r.status})`);
    }),
  );
  jalon('depot_termine');
  const apresDepot = pile.kv.instantane();

  // Client : consultation puis sondage tant que « en cours ».
  const consultations: { a: number; ms: number; etat: string; lues: number; vue: boolean; rendus: number }[] = [];
  const debutSuivi = Date.now();
  for (let i = 0; i < 80; i++) {
    const a = depuis();
    const d = await c.json('GET', `/api/dossiers/${id}`);
    const lues = d.pieces.filter((p: { lecture: unknown }) => p.lecture).length;
    const rendus = d.rendus.filter((r: { fichiers: unknown[] }) => r.fichiers.length).length;
    consultations.push({ a, ms: depuis() - a, etat: d.statut.etat, lues, vue: Boolean(d.vue), rendus });
    if (lues > 0) jalon('client_premiere_piece_lue');
    if (d.vue) jalon('client_premier_resultat');
    if (rendus === 6) jalon('client_six_rendus');
    if (d.statut.etat !== 'en_cours') {
      jalon('client_pret');
      break;
    }
    await pause(o.sondage === 'adaptatif' ? delaiSondage(Date.now() - debutSuivi) : Number(o.sondage));
  }
  await pile.repos();
  clearInterval(sonde);
  return { latence_ms: [o.minMs, o.maxMs], latence_ecriture_ms: o.ecriture ? [o.ecriture.minMs, o.ecriture.maxMs] : null, sondage: o.sondage, jalons_ms: jalons, sans_acces_en_vol_avant_vue_ms: inactif, acces_depot: apresDepot, acces_total: pile.kv.instantane(), operations: pile.kv.operations, parallelisme_max: pile.kv.maxEnVol, executeur: pile.compteurs, acces_par_cle: Object.fromEntries(Object.entries(parPrefixe).sort((x, y) => y[1] - x[1]).slice(0, 24)), consultations, ...(trace.length ? { trace } : {}) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Essais de réglage (facultatifs) : --anti-rebond=<ms> --attente=<ms> remplacent les délais du moteur.
  const config: Partial<EngineConfig> = {};
  if (arg('anti-rebond', '')) config.consolidateDelayMs = Number(arg('anti-rebond', ''));
  if (arg('attente', '')) config.extractionWaitMs = Number(arg('attente', ''));
  const [eMin, eMax] = arg('ecriture', '').split('-').map(Number);
  const r = await mesurerLatence({ minMs, maxMs, ecriture: eMin > 0 ? { minMs: eMin, maxMs: eMax || eMin } : undefined, sondage, config });
  console.log(JSON.stringify(r, null, process.argv.includes('--json') ? 0 : 2));
}
