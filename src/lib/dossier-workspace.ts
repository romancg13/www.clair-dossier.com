
/**
 * Espace dossier — organisation documentaire (classement, échéances, activité).
 *
 * Rétrocompatibilité : les colonnes/tables ajoutées par la migration
 * 20260915120000_gestion_documentaire.sql peuvent ne pas encore exister en
 * production. Chaque capacité est donc DÉTECTÉE à l'exécution (une requête
 * témoin, mise en cache) et l'interface se replie sur le comportement
 * historique tant que la migration n'est pas appliquée. Aucune perte de
 * données, aucun écran cassé.
 */

/* ── Classification déterministe des pièces ─────────────────────────────
 * Aucune lecture du CONTENU des documents (engagement CGV) : seules des
 * règles sur le NOM du fichier sont utilisées. La catégorie corrigée par
 * l'utilisateur (colonne `category`) est toujours prioritaire. */

export type PieceCategory = {
  id: string;
  label: string;
  /** Motifs testés sur le nom de fichier, insensibles à la casse/accents. */
  patterns: RegExp[];
};

export const PIECE_CATEGORIES: PieceCategory[] = [
  { id: 'contrats', label: 'Contrats & conventions', patterns: [/contrat/, /convention/, /avenant/, /cgv/, /conditions[-_ ]generales/, /bail/] },
  { id: 'devis', label: 'Devis & commandes', patterns: [/devis/, /bon[-_ ]?de[-_ ]?commande/, /\bcommande/, /proposition/] },
  { id: 'factures', label: 'Factures & avoirs', patterns: [/facture/, /avoir/, /fact[-_ ]?\d/, /invoice/, /note[-_ ]?d[e']?[-_ ]?frais/] },
  { id: 'courriers', label: 'Courriers', patterns: [/courrier/, /lettre/, /recommande/, /\blrar\b/, /mise[-_ ]?en[-_ ]?demeure/, /relance/] },
  { id: 'emails', label: 'E-mails & échanges', patterns: [/e?[-_ ]?mail/, /courriel/, /echange/, /whatsapp/, /sms/] },
  { id: 'procedure', label: 'Pièces de procédure', patterns: [/assignation/, /conclusion/, /jugement/, /ordonnance/, /requete/, /huissier/, /commissaire/, /proces[-_ ]?verbal/, /\bpv\b/] },
  { id: 'paiements', label: 'Paiements & justificatifs', patterns: [/paiement/, /reglement/, /virement/, /releve/, /recu/, /quittance/, /cheque/] },
  { id: 'administratif', label: 'Administratif', patterns: [/kbis/, /attestation/, /assurance/, /urssaf/, /impot/, /siren/, /siret/, /declaration/, /certificat/] },
  { id: 'autres', label: 'Autres pièces', patterns: [] },
];

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  PIECE_CATEGORIES.map((c) => [c.id, c.label]),
);

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Catégorie déterministe d'après le nom de fichier ; « autres » si incertain. */
export function classifyFileName(fileName: string): string {
  const n = normalize(fileName);
  for (const cat of PIECE_CATEGORIES) {
    if (cat.patterns.some((p) => p.test(n))) return cat.id;
  }
  return 'autres';
}

/** Catégorie effective : correction utilisateur (DB) prioritaire sur la règle. */
export function effectiveCategory(fileName: string, stored?: string | null): string {
  if (stored && CATEGORY_LABELS[stored]) return stored;
  return classifyFileName(fileName);
}

/* ── Échéances ──────────────────────────────────────────────────────────── */

export type DeadlineStatus = 'retard' | 'a-venir' | 'terminee';

export function deadlineStatus(dueDate: string, done: boolean, today = new Date()): DeadlineStatus {
  if (done) return 'terminee';
  const d = new Date(`${dueDate}T23:59:59`);
  return d.getTime() < today.getTime() ? 'retard' : 'a-venir';
}

/* ── Upload : validation partagée (création + ajout sur dossier existant) ── */

export const ACCEPTED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'txt'];
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(',');
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 Mo

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
}

/** Retourne un message d'erreur (français) ou null si le fichier est accepté. */
export function validateUpload(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ACCEPTED_EXTENSIONS.includes(ext)) {
    return `« ${file.name} » : format non accepté (formats : ${ACCEPTED_EXTENSIONS.join(', ')}).`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `« ${file.name} » : fichier trop volumineux (maximum 25 Mo).`;
  }
  if (file.size === 0) {
    return `« ${file.name} » : fichier vide.`;
  }
  return null;
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

/* ── Détection des capacités (migration appliquée ou non) ───────────────── */

const capabilityCache: Record<string, Promise<boolean>> = {};

async function client() {
  const { supabase } = await import('./supabase');
  return supabase;
}

function probe(key: string, run: () => Promise<boolean>): Promise<boolean> {
  if (!(key in capabilityCache)) {
    capabilityCache[key] = run().catch(() => false);
  }
  return capabilityCache[key];
}

/** Colonnes category / deleted_at disponibles sur dossier_documents ? */
export function hasDocExtras(): Promise<boolean> {
  return probe('doc-extras', async () => {
    const { error } = await (await client())
      .from('dossier_documents')
      .select('id,category,deleted_at')
      .limit(1);
    return !error;
  });
}

/** Table dossier_deadlines disponible ? */
export function hasDeadlines(): Promise<boolean> {
  return probe('deadlines', async () => {
    const { error } = await (await client()).from('dossier_deadlines').select('id').limit(1);
    return !error;
  });
}

/** Table dossier_events disponible ? */
export function hasEvents(): Promise<boolean> {
  return probe('events', async () => {
    const { error } = await (await client()).from('dossier_events').select('id').limit(1);
    return !error;
  });
}

/* ── Journal d'activité (meilleur effort, jamais bloquant) ──────────────── */

export type EventType =
  | 'document_ajoute'
  | 'document_renomme'
  | 'document_reclasse'
  | 'document_corbeille'
  | 'document_restaure'
  | 'document_supprime'
  | 'dossier_renomme'
  | 'echeance_creee'
  | 'echeance_modifiee'
  | 'echeance_terminee'
  | 'echeance_supprimee'
  | 'telechargement_groupe';

export const EVENT_LABELS: Record<EventType, string> = {
  document_ajoute: 'Document ajouté',
  document_renomme: 'Document renommé',
  document_reclasse: 'Document reclassé',
  document_corbeille: 'Document placé dans la corbeille',
  document_restaure: 'Document restauré',
  document_supprime: 'Document supprimé définitivement',
  dossier_renomme: 'Dossier renommé',
  echeance_creee: 'Échéance ajoutée',
  echeance_modifiee: 'Échéance modifiée',
  echeance_terminee: 'Échéance terminée',
  echeance_supprimee: 'Échéance supprimée',
  telechargement_groupe: 'Téléchargement groupé des pièces',
};

/** Journalise un événement ; silencieux si la table n'existe pas encore. */
export async function logDossierEvent(
  dossierId: string,
  userId: string,
  type: EventType,
  detail?: string,
): Promise<void> {
  try {
    if (!(await hasEvents())) return;
    await (await client()).from('dossier_events').insert({
      dossier_id: dossierId,
      user_id: userId,
      type,
      label: detail ? `${EVENT_LABELS[type]} — ${detail}` : EVENT_LABELS[type],
    });
  } catch {
    /* jamais bloquant */
  }
}

/* ── Titres génériques (héritage : catégorie utilisée comme titre) ──────── */

const GENERIC_TITLES = new Set(
  [
    'autre', 'dossier client', 'facture / paiement', 'impayé / pré-contentieux',
    'dossier administratif', 'documents comptables', 'personnel / rh',
    'litige commercial', 'recouvrement', 'bail & immobilier',
    'litige client / fournisseur', "prud'hommes", 'divorce / famille', 'succession',
    'dossier-client', 'facture-paiement', 'impaye-precontentieux', 'administratif',
    'comptable', 'rh',
  ].map((t) => normalize(t)),
);

/** Vrai si le titre est vide ou n'est qu'une reprise de catégorie (à renommer). */
export function isGenericTitle(title: string | null | undefined): boolean {
  if (!title?.trim()) return true;
  return GENERIC_TITLES.has(normalize(title.trim()));
}
