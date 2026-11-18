// État reprenable de la mise en service du moteur IA (npm run ia:commission).
// Fichier local `.ia-commission/etat.json` (ignoré par Git) : versions,
// empreintes, statuts et preuves NON sensibles uniquement — jamais de secret,
// jamais de contenu de dossier.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const ETATS = ['PRECHECK', 'CONFIGURATION_REQUISE', 'INFRA_PRETE', 'RECETTE_REUSSIE', 'VALIDATION_REQUISE', 'ACTIF', 'SUSPENDU', 'INCIDENT'];

/** Fichiers dont dépend l'infrastructure IA : toute modification invalide les contrôles. */
export const PERIMETRE = [
  'supabase/migrations/20261023120000_moteur_documentaire_ia.sql',
  'supabase/migrations/20261102120000_ia_console_privee.sql',
  'supabase/migrations/20261104120000_ia_budget_global.sql',
  'supabase/functions/ai-worker',
  'supabase/functions/_shared/ai-pipeline.ts',
  'supabase/functions/_shared/analysis-model.ts',
  'supabase/functions/_shared/deliverables.ts',
  'supabase/functions/_shared/office.ts',
];

function fichiers(root, p) {
  const abs = join(root, p);
  if (!existsSync(abs)) return [];
  if (!statSync(abs).isDirectory()) return [abs];
  return readdirSync(abs).flatMap((f) => fichiers(root, relative(root, join(abs, f))));
}

export function empreinte(root) {
  const h = createHash('sha256');
  for (const f of PERIMETRE.flatMap((p) => fichiers(root, p)).sort()) {
    h.update(relative(root, f)).update('\0').update(readFileSync(f));
  }
  return h.digest('hex').slice(0, 16);
}

export function charger(root) {
  const f = join(root, '.ia-commission', 'etat.json');
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : { etapes: {}, approbations: [] };
}

export function enregistrer(root, etat) {
  mkdirSync(join(root, '.ia-commission'), { recursive: true });
  writeFileSync(join(root, '.ia-commission', 'etat.json'), JSON.stringify({ ...etat, maj: new Date().toISOString() }, null, 2) + '\n');
}

/** Une étape n'est valable que pour l'empreinte de code qui l'a vérifiée. */
export function valide(etat, id, emp) {
  const e = etat.etapes?.[id];
  return Boolean(e?.ok && e.empreinte === emp);
}

export function marquer(etat, id, ok, emp, preuve) {
  return { ...etat, etapes: { ...etat.etapes, [id]: { ok, empreinte: emp, preuve, le: new Date().toISOString() } } };
}

/** Documents dont l'approbation écrite du propriétaire est exigée avant tout traitement réel. */
export const APPROBATIONS_REQUISES = [
  ['cgv-art6', 'CGV, article 6 — texte autorisant le traitement automatique (docs/ia/TEXTES_A_APPROUVER.md)'],
  ['confidentialite', 'Politique de confidentialité — fournisseur IA, transferts, conservation (docs/ia/TEXTES_A_APPROUVER.md)'],
  ['aipd', 'Analyse d’impact (AIPD) — conclusions et mesures (docs/ia/AIPD.md)'],
  ['budget', 'Budget mensuel IA (par compte et global) — valeurs posées en secrets serveur'],
  ['hebergement', 'Hébergement du site public compatible avec un usage commercial (docs/ia/CHECKLIST_PROPRIETAIRE.md §1)'],
];

export function approbationsManquantes(etat) {
  const faites = new Set((etat.approbations ?? []).map((a) => a.id));
  return APPROBATIONS_REQUISES.filter(([id]) => !faites.has(id));
}
