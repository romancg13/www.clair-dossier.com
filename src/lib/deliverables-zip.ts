// Archive ZIP des livrables d'UN dossier, construite dans le navigateur (fflate).
// Fonctions pures, testées sous Node (tests/deliverables-zip.test.ts) : aucun
// appel réseau ici, aucun appel IA — l'appelant fournit lui-même, fichier par
// fichier, le moyen d'obtenir le contenu (stockage signé, génération locale…).
import { zipSync, type Zippable } from "fflate";

/** Fichier à archiver : son nom et le moyen d'en obtenir le contenu. */
export interface ZipSource {
  name: string;
  getBlob: () => Promise<Blob>;
}

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

/** Formats déjà compressés : stockés tels quels (recompresser ne ferait que ralentir). */
const STORED = /\.(pdf|docx|xlsx|pptx|zip|png|jpe?g|webp|heic)$/i;

/** Nom d'entrée sûr : jamais de chemin (ni « ../ »), ni caractère de contrôle. */
export function safeEntryName(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/^\.+/, "")
    .trim();
  return base || "fichier";
}

/** Nom d'archive lisible à partir de l'intitulé du dossier. */
export function zipFileName(title: string | null | undefined): string {
  const slug = (title ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `documents-${slug || "dossier"}.zip`;
}

/**
 * Archive les entrées fournies. Les noms sont assainis ; deux fichiers de même
 * nom sont conservés tous les deux (« nom (2).ext »). `mtime` fixe l'horodatage
 * des entrées (archive reproductible dans les tests).
 */
export function zipEntries(entries: ZipEntry[], mtime: Date = new Date()): Uint8Array {
  if (entries.length === 0) throw new Error("Aucun fichier à archiver");
  const out: Zippable = {};
  const used = new Set<string>();
  for (const e of entries) {
    const base = safeEntryName(e.name);
    const dot = base.lastIndexOf(".");
    const [stem, ext] = dot > 0 ? [base.slice(0, dot), base.slice(dot)] : [base, ""];
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${stem} (${n})${ext}`;
    used.add(name.toLowerCase());
    out[name] = [e.bytes, { level: STORED.test(name) ? 0 : 6, mtime }];
  }
  return zipSync(out);
}

export interface ZipResult {
  /** Archive, ou null si aucun fichier n'a pu être obtenu. */
  zip: Uint8Array | null;
  included: string[];
  /** Fichiers indisponibles : signalés à l'utilisateur, jamais ignorés en silence. */
  failed: string[];
}

/** Récupère chaque fichier (l'un après l'autre) puis construit l'archive. */
export async function buildZip(files: ZipSource[], mtime?: Date): Promise<ZipResult> {
  const entries: ZipEntry[] = [];
  const failed: string[] = [];
  for (const f of files) {
    try {
      entries.push({ name: f.name, bytes: new Uint8Array(await (await f.getBlob()).arrayBuffer()) });
    } catch {
      failed.push(f.name);
    }
  }
  return { zip: entries.length ? zipEntries(entries, mtime) : null, included: entries.map((e) => e.name), failed };
}
