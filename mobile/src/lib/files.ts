/**
 * Fichiers — import, envoi, consultation, partage.
 *
 * Sécurité (§22) :
 *   - le bucket `documents` est privé ; rien n'est jamais rendu public ;
 *   - le chemin de stockage commence TOUJOURS par l'identifiant du compte
 *     (`<user_id>/<dossier_id>/…`), clé du cloisonnement RLS ;
 *   - l'envoi se fait en flux depuis le disque avec le jeton de l'utilisateur
 *     (aucun service_role côté appareil, aucun fichier chargé en mémoire) ;
 *   - la consultation passe par un lien signé de 2 minutes ;
 *   - les copies temporaires du cache sont effacées après usage.
 */
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import {
  duplicateWarning,
  extensionOf,
  sanitizeFileName,
  storagePath,
  validateUploadMeta,
  type ExistingDoc,
} from '@clairdossier/core';
import { supabase } from './supabase';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import { currentAccessToken } from './supabase';
import { log } from './logger';
import { colors } from '../theme/tokens';

export type PickedFile = {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
};

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

export function mimeFor(fileName: string, fallback?: string | null): string {
  return MIME_BY_EXT[extensionOf(fileName)] ?? fallback ?? 'application/octet-stream';
}

/* ── Sélection ───────────────────────────────────────────────────────────── */

/** Documents (PDF, images, Word, texte) depuis Fichiers / Drive / iCloud. */
export async function pickDocuments(): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: ['application/pdf', 'image/*', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({
    uri: a.uri,
    name: a.name ?? 'document',
    size: a.size ?? 0,
    mimeType: mimeFor(a.name ?? '', a.mimeType),
  }));
}

/** Photos de la galerie — l'utilisateur choisit, rien n'est parcouru en fond. */
export async function pickFromLibrary(): Promise<PickedFile[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 0.85,
    exif: false, // aucune donnée de localisation embarquée (§29)
  });
  if (result.canceled) return [];
  return result.assets.map((a, i) => {
    const name = a.fileName ?? `photo-${Date.now()}-${i + 1}.jpg`;
    return { uri: a.uri, name, size: a.fileSize ?? sizeOf(a.uri), mimeType: mimeFor(name, a.mimeType) };
  });
}

function sizeOf(uri: string): number {
  try {
    return new File(uri).size ?? 0;
  } catch {
    return 0;
  }
}

/* ── Contrôles avant envoi ───────────────────────────────────────────────── */

export type UploadCheck = { ok: boolean; error?: string; warning?: string };

export function checkBeforeUpload(file: PickedFile, existing: ExistingDoc[]): UploadCheck {
  const size = file.size || sizeOf(file.uri);
  const error = validateUploadMeta({ name: file.name, size });
  if (error) return { ok: false, error };
  const warning = duplicateWarning({ name: file.name, size }, existing) ?? undefined;
  return { ok: true, warning };
}

/* ── Envoi ───────────────────────────────────────────────────────────────── */

export type UploadResult = { path: string; name: string; size: number };

/**
 * Envoie un fichier dans le bucket privé, en flux, avec progression.
 * N'écrit PAS la ligne `dossier_documents` : l'appelant le fait (il connaît le
 * contexte métier et journalise l'événement).
 */
export async function uploadToStorage(
  file: PickedFile,
  userId: string,
  dossierId: string,
  onProgress?: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<UploadResult> {
  const token = await currentAccessToken();
  if (!token) throw Object.assign(new Error('no-session'), { status: 401 });

  const path = storagePath(userId, dossierId, file.name);
  const url = `${SUPABASE_URL}/storage/v1/object/documents/${encodeURI(path)}`;
  const handle = new File(file.uri);
  const total = handle.size ?? file.size ?? 0;

  const task = handle.createUploadTask(url, {
    httpMethod: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': file.mimeType,
      'x-upsert': 'false',
      'cache-control': 'no-store',
    },
    mimeType: file.mimeType,
    onProgress: ({ bytesSent, totalBytes }) => {
      const denominator = totalBytes > 0 ? totalBytes : total;
      if (denominator > 0) onProgress?.(Math.min(1, bytesSent / denominator));
    },
    signal,
  });

  const response = await task.uploadAsync();
  if (response.status >= 300) {
    log.warn('upload.rejected', `status=${response.status}`);
    throw Object.assign(new Error('upload-failed'), { status: response.status });
  }
  onProgress?.(1);
  return { path, name: sanitizeFileName(file.name) === file.name ? file.name : file.name, size: total };
}

/* ── Consultation et partage ─────────────────────────────────────────────── */

/** Ouvre une pièce via un lien signé temporaire (visionneuse système). */
export async function openDocument(filePath: string): Promise<void> {
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(filePath, 120);
  if (error || !data?.signedUrl) throw error ?? new Error('signed-url');
  await WebBrowser.openBrowserAsync(data.signedUrl, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    toolbarColor: colors.background,
    controlsColor: colors.surfaceInverse,
    dismissButtonStyle: 'close',
  });
}

/**
 * Partage ou enregistre une pièce : téléchargement dans le cache de
 * l'application, feuille de partage système, puis effacement de la copie.
 */
export async function shareDocument(filePath: string, fileName: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing-unavailable');
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(filePath, 120);
  if (error || !data?.signedUrl) throw error ?? new Error('signed-url');

  const target = new File(Paths.cache, sanitizeFileName(fileName));
  try {
    if (target.exists) target.delete();
  } catch {
    /* le cache peut être vide */
  }
  const downloaded = await File.downloadFileAsync(data.signedUrl, target);
  try {
    await Sharing.shareAsync(downloaded.uri, {
      mimeType: mimeFor(fileName),
      dialogTitle: fileName,
      UTI: extensionOf(fileName) === 'pdf' ? 'com.adobe.pdf' : undefined,
    });
  } finally {
    // Aucune copie du document ne reste sur l'appareil (§28).
    try {
      downloaded.delete();
    } catch {
      /* rien à faire */
    }
  }
}
