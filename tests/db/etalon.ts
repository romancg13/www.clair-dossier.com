/**
 * Aides partagées par les tests qui déposent les pièces du dossier étalon
 * (tests/fixtures/dossier-etalon, données fictives) dans la base locale.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Tx } from './harness';

export const DIR = resolve(__dirname, '../fixtures/dossier-etalon');

export type PieceManifest = { fichier: string; role: string; categorie: string; titre: string };
export type VeriteTerrain = {
  doublons_stricts: { piece: string; original: string }[];
  quasi_doublons: { piece: string; original: string }[];
  documents_illisibles: { piece: string; attendu: string }[];
  ingestion_attendue: Record<string, string[]>;
  recherche_attendue: { requete: string; pieces_attendues: string[] }[];
  entites_attendues: { type: string; valeur_normalisee: string; pieces: string[] }[];
  injection_attendue: {
    piece: string;
    detectee: boolean;
    passage: string;
    assertions_interdites: { type: string; valeur_normalisee: string; raison: string }[];
    assertions_legitimes: { type: string; valeur_normalisee: string }[];
  };
  echo_attendu: {
    verdict_par_piece: Record<string, 'accepte' | 'minimise' | 'bloque'>;
    donnees_sensibles_par_piece: Record<string, string[]>;
    valeur_jamais_livree: string;
  };
};

export const manifest = JSON.parse(readFileSync(resolve(DIR, 'manifest.json'), 'utf8')) as { pieces: PieceManifest[] };
export const verite = JSON.parse(readFileSync(resolve(DIR, 'verite-terrain.json'), 'utf8')) as VeriteTerrain;

export const bytesOf = (fichier: string) => readFileSync(resolve(DIR, fichier));
export const hashOf = (fichier: string) => createHash('sha256').update(bytesOf(fichier)).digest('hex');
export const sizeOf = (fichier: string) => bytesOf(fichier).length;
export const estUnePieceEtalon = (fichier: string) => existsSync(resolve(DIR, fichier));

export type DocRow = { id: string; file_name: string; statut_ingestion: string; doublon_de_id: string | null };

/** Utilisateurs A (propriétaire du dossier étalon), B (autre tenant), admin global ; bucket « documents ». */
export async function dossierEtalon(tx: Tx) {
  const a = await tx.createUser('etalon@test.invalid', { full_name: 'A Étalon' });
  const b = await tx.createUser('autre@test.invalid', { full_name: 'B Autre' });
  const admin = await tx.createUser('admin-etalon@test.invalid', { full_name: 'Admin' });
  await tx.sql('insert into public.app_admins (user_id) values ($1)', [admin.id]);
  await tx.sql("insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing");
  await tx.as(a.id);
  const d = await tx.sql<{ id: string }>(
    `insert into public.dossiers (user_id, typology, title, status)
     values ($1, 'impaye-precontentieux', 'Impayé — Atelier Fictif SAS c/ Société Exemple SARL', 'transmis') returning id`,
    [a.id],
  );
  return { a, b, admin, dossierId: d[0].id };
}

/**
 * Dépose une pièce comme le client : chemin <user>/<dossier>/<nom>, empreinte et MIME
 * transmis. Pour un nom hors dossier étalon, l'empreinte est celle fournie (ou absente).
 */
export async function deposer(
  tx: Tx,
  userId: string,
  dossierId: string,
  fichier: string,
  extra: { hash?: string | null; kind?: string; mime?: string | null; size?: number } = {},
) {
  const etalon = estUnePieceEtalon(fichier);
  const hash = extra.hash !== undefined ? extra.hash : etalon ? hashOf(fichier) : null;
  const mime = extra.mime !== undefined ? extra.mime : 'application/pdf';
  const size = extra.size ?? (etalon ? sizeOf(fichier) : 10);
  const rows = await tx.sql<DocRow>(
    `insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, size_bytes, hash_sha256, mime, kind)
     values ($1::uuid, $2::uuid, $2::text || '/' || $1::text || '/' || $3::text, $3::text, $4::bigint, $5::text, $6::text, $7::text)
     returning id, file_name, statut_ingestion, doublon_de_id`,
    [dossierId, userId, fichier, size, hash, mime, extra.kind ?? 'piece'],
  );
  return rows[0];
}
