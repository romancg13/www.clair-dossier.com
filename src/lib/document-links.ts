// Accès aux fichiers du bucket privé « documents » — source unique pour le
// dépôt vérifié, la génération des liens signés et le diagnostic d'un fichier
// absent. Aucune clé privée : tout passe par la session de l'utilisateur et
// les policies RLS existantes (storage.objects + dossier_documents).
import { supabase } from "./supabase";

export const DOCS_BUCKET = "documents";
/** Durée de validité d'un lien signé (secondes). */
export const LINK_TTL_S = 3600;
/** Au-delà, le lien est régénéré au clic (marge de 10 min sur LINK_TTL_S). */
export const LINK_MAX_AGE_MS = 50 * 60 * 1000;

/**
 * État d'accès d'un document :
 * - ok : lien signé valide (généré à `at`) ;
 * - missing : l'objet n'existe pas dans le stockage → « Fichier à réimporter » ;
 * - error : échec réseau/serveur transitoire → nouvel essai possible.
 */
export type LinkState =
  | { status: "ok"; url: string; at: number }
  | { status: "missing" }
  | { status: "error" };

type StorageErr = { message?: string; status?: number; statusCode?: string | number } | null;

function errStatus(err: StorageErr): number | undefined {
  if (!err) return undefined;
  const s = err.status ?? (err.statusCode != null ? Number(err.statusCode) : undefined);
  return Number.isFinite(s) ? (s as number) : undefined;
}

function isNotFound(err: StorageErr): boolean {
  if (!err) return false;
  const s = errStatus(err);
  return s === 404 || s === 400 || /not.?found|does not exist/i.test(err.message ?? "");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Une requête réseau bloquée ne doit jamais figer un bouton : rejet après `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("délai dépassé")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** HEAD authentifié : true = présent, false = absent, null = indéterminé (réseau). */
export async function objectExists(path: string): Promise<boolean | null> {
  try {
    const { data, error } = await withTimeout(supabase.storage.from(DOCS_BUCKET).exists(path), 15000);
    if (data === true) return true;
    if (data === false && isNotFound(error as StorageErr)) return false;
    return data === false ? false : null;
  } catch {
    return null;
  }
}

/** Lien signé frais, avec nouvelles tentatives et diagnostic « fichier absent ». */
export async function signDocument(path: string | null | undefined, ttl = LINK_TTL_S): Promise<LinkState> {
  if (!path || !path.trim()) return { status: "missing" };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await withTimeout(
        supabase.storage.from(DOCS_BUCKET).createSignedUrl(path, ttl),
        15000,
      );
      if (data?.signedUrl) return { status: "ok", url: data.signedUrl, at: Date.now() };
      if (isNotFound(error as StorageErr)) {
        const exists = await objectExists(path);
        if (exists === false) return { status: "missing" };
      }
    } catch {
      /* réseau : nouvel essai */
    }
    await sleep(350 * (attempt + 1));
  }
  return { status: "error" };
}

/** Nom de téléchargement : le nom affiché, complété de l'extension réelle du fichier stocké. */
export function downloadName(fileName: string | null | undefined, filePath: string): string {
  const base = (fileName ?? "").trim() || filePath.split("/").pop() || "document";
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base;
  const ext = filePath.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  return ext ? `${base}.${ext.toLowerCase()}` : base;
}

/** Extension affichée (PDF, DOCX…) tirée du nom de téléchargement. */
export function displayExt(fileName: string, filePath: string): string {
  const m = downloadName(fileName, filePath).match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1].toUpperCase() : "";
}

/** Ajoute la consigne de téléchargement (Content-Disposition) à un lien signé. */
export function withDownload(url: string, name: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(name)}`;
}

/** Message utilisateur pour un échec de dépôt (taille, droits, réseau). */
export function uploadErrorMessage(err: unknown, fallback: string): string {
  const e = err as StorageErr;
  const s = errStatus(e);
  const msg = e?.message ?? "";
  if (s === 413 || /maximum allowed size|too large|payload/i.test(msg))
    return "Fichier refusé par le stockage : taille supérieure à la limite autorisée. Rien n'a été enregistré.";
  if (s === 401 || s === 403 || /row-level security|unauthorized|not allowed/i.test(msg))
    return "Dépôt refusé : droits insuffisants sur ce dossier. Rien n'a été enregistré.";
  return fallback;
}

/**
 * Dépôt fiable : upload → confirmation de présence dans le stockage → ligne en
 * base. En cas d'échec de l'enregistrement, l'objet déposé est retiré (pas de
 * fichier orphelin) et l'erreur est remontée : un document n'est jamais
 * déclaré disponible si son fichier n'est pas réellement stocké.
 */
export async function uploadVerified(
  path: string,
  file: File,
  row: Record<string, unknown> | null,
): Promise<void> {
  const up = await supabase.storage
    .from(DOCS_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type || guessType(file.name) });
  if (up.error) throw up.error;
  let present: boolean | null = null;
  for (let i = 0; i < 3 && present !== true; i++) {
    present = await objectExists(path);
    if (present !== true) await sleep(400 * (i + 1));
  }
  if (present !== true) {
    if (present === false) throw Object.assign(new Error("upload non confirmé"), { status: 500 });
    // Indéterminé (réseau) : le lien signé fait foi.
    const s = await signDocument(path, 60);
    if (s.status !== "ok") throw Object.assign(new Error("upload non confirmé"), { status: 500 });
  }
  if (!row) return;
  const ins = await supabase.from("dossier_documents").insert({ ...row, file_path: path });
  if (ins.error) {
    await supabase.storage.from(DOCS_BUCKET).remove([path]);
    throw ins.error;
  }
}

function guessType(name: string): string | undefined {
  const ext = name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    txt: "text/plain",
  };
  return ext ? map[ext] : undefined;
}

/**
 * Réparation d'un document dont le chemin enregistré ne pointe vers aucun
 * objet : recherche du fichier réel dans le dossier de stockage du dossier
 * (variantes de chemin, puis objet non référencé de même taille). Ne met la
 * ligne à jour que si UN seul candidat correspond — jamais de devinette.
 * Retourne le nouveau chemin, ou null si le fichier est réellement absent.
 */
export async function locateMissingObject(
  doc: { id: string; file_path: string; size_bytes: number | null },
  ownerId: string,
  dossierId: string,
  referencedPaths: Set<string>,
): Promise<string | null> {
  const raw = doc.file_path ?? "";
  const variants = Array.from(
    new Set(
      [raw.trim(), raw.replace(/^\/+/, ""), raw.replace(/^documents\//, ""), safeDecode(raw)].filter(
        (p) => p && p !== raw,
      ),
    ),
  );
  for (const v of variants) {
    if ((await objectExists(v)) === true) return persistPath(doc.id, v);
  }
  if (!doc.size_bytes) return null;
  const folder = `${ownerId}/${dossierId}`;
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).list(folder, { limit: 1000 });
  if (error || !data) return null;
  const candidates = data
    .filter((o) => o.id && !referencedPaths.has(`${folder}/${o.name}`))
    .filter((o) => Number((o.metadata as { size?: number } | null)?.size) === doc.size_bytes);
  if (candidates.length !== 1) return null;
  return persistPath(doc.id, `${folder}/${candidates[0].name}`);
}

function safeDecode(p: string): string {
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}

async function persistPath(docId: string, path: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("dossier_documents")
    .update({ file_path: path })
    .eq("id", docId)
    .select("id");
  return !error && data?.length ? path : null;
}
