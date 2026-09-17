/**
 * Pièces d'un dossier — classification, validation, doublons.
 *
 * Extrait de `src/lib/dossier-workspace.ts` (site web, en production) pour être
 * partagé avec l'application mobile. Comportement identique : mêmes catégories,
 * mêmes motifs, mêmes limites — le web et le mobile écrivent donc exactement les
 * mêmes valeurs dans `dossier_documents.category`.
 *
 * Aucune lecture du CONTENU des documents (engagement CGV) : seules des règles
 * sur le NOM du fichier sont utilisées. La catégorie corrigée par l'utilisateur
 * (colonne `category`) est toujours prioritaire.
 */

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

/** Minuscules sans accents — base commune aux comparaisons de libellés. */
export function normalizeLabel(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Catégorie déterministe d'après le nom de fichier ; « autres » si incertain. */
export function classifyFileName(fileName: string): string {
  const n = normalizeLabel(fileName);
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

/* ── Upload : validation partagée (web : <input type=file> ; mobile : caméra,
 *    galerie, fichiers, partage entrant) ─────────────────────────────────── */

export const ACCEPTED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'txt'];
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(',');
export const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 Mo

/** Types MIME acceptés, alignés sur ACCEPTED_EXTENSIONS (contrôle serveur/mobile). */
export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export function extensionOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

/** Nom de fichier assaini pour le chemin de stockage (bucket `documents`). */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
}

export type UploadCandidate = { name: string; size: number };

/**
 * Retourne un message d'erreur (français) ou null si le fichier est accepté.
 * Même règle exacte que le site web : extension, taille, fichier vide.
 */
export function validateUploadMeta(file: UploadCandidate): string | null {
  const ext = extensionOf(file.name);
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

/* ── Doublons documentaires (règles prudentes, jamais bloquantes) ───────── */

export type ExistingDoc = { file_name: string; size_bytes: number | null };

/** Message d'avertissement si le fichier semble déjà présent, sinon null.
 *  Même nom (insensible à la casse) = quasi-certain ; même taille exacte
 *  (> 0) = possible. On avertit, on ne bloque jamais. */
export function duplicateWarning(file: UploadCandidate, existing: ExistingDoc[]): string | null {
  const name = file.name.trim().toLowerCase();
  if (existing.some((d) => d.file_name.trim().toLowerCase() === name)) {
    return `« ${file.name} » est déjà présent dans ce dossier (même nom).`;
  }
  if (file.size > 0 && existing.some((d) => d.size_bytes === file.size)) {
    return `« ${file.name} » semble déjà présent (taille identique à une pièce existante).`;
  }
  return null;
}

/**
 * Chemin de stockage d'une pièce dans le bucket privé `documents`.
 * Format historique, inchangé : `<user_id>/<dossier_id>/<timestamp>-<nom assaini>`
 * — le premier segment est la clé du cloisonnement RLS (storage.foldername(name)[1]).
 */
export function storagePath(userId: string, dossierId: string, fileName: string, now = Date.now()): string {
  return `${userId}/${dossierId}/${now}-${sanitizeFileName(fileName)}`;
}

/** Regroupe des pièces par catégorie effective, dans l'ordre de PIECE_CATEGORIES. */
export function groupByCategory<T extends { file_name: string; category?: string | null }>(
  docs: T[],
): { id: string; label: string; items: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const doc of docs) {
    const id = effectiveCategory(doc.file_name, doc.category);
    const list = buckets.get(id);
    if (list) list.push(doc);
    else buckets.set(id, [doc]);
  }
  return PIECE_CATEGORIES.filter((c) => buckets.has(c.id)).map((c) => ({
    id: c.id,
    label: c.label,
    items: buckets.get(c.id) as T[],
  }));
}
