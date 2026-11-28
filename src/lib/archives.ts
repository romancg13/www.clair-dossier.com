import { ACCEPTED_EXTENSIONS } from '../../packages/core/src/index';

/**
 * Dépôt d'une archive ZIP : elle est ouverte dans le navigateur et ses fichiers sont déposés
 * un par un (jamais l'archive elle-même, illisible pour l'analyse). Couvre aussi une archive
 * renommée (« .pdf » qui commence par la signature ZIP).
 */

const MAX_ENTRIES = 250;
const MAX_ENTRY_BYTES = 25 * 1024 * 1024;
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
// Formats bureautiques qui SONT des conteneurs ZIP : jamais ouverts comme archives.
const ZIP_BASED = new Set(['docx', 'xlsx', 'pptx', 'odt', 'ods']);
const MIME: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain' };

const ext = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

async function isArchive(file: File): Promise<boolean> {
  const e = ext(file.name);
  if (ZIP_BASED.has(e)) return false;
  if (e === 'zip') return true;
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return ZIP_MAGIC.every((b, i) => head[i] === b);
}

export interface Expanded {
  files: File[];
  /** Entrées d'archive ignorées (format non accepté, trop volumineuses), pour information. */
  skipped: string[];
}

/** Remplace chaque archive par ses fichiers acceptés ; les autres fichiers passent tels quels. */
export async function expandArchives(input: File[]): Promise<Expanded> {
  const files: File[] = [];
  const skipped: string[] = [];
  for (const file of input) {
    if (!(await isArchive(file))) {
      files.push(file);
      continue;
    }
    const { unzipSync } = await import('fflate');
    let entries: Record<string, Uint8Array>;
    try {
      // Le filtre écarte dossiers, fichiers système et entrées trop volumineuses AVANT décompression.
      entries = unzipSync(new Uint8Array(await file.arrayBuffer()), {
        filter: (f) => !f.name.endsWith('/') && !f.name.startsWith('__MACOSX/') && !f.name.split('/').pop()!.startsWith('.') && f.originalSize <= MAX_ENTRY_BYTES,
      });
    } catch {
      skipped.push(`${file.name} (archive illisible)`);
      continue;
    }
    for (const [path, bytes] of Object.entries(entries).slice(0, MAX_ENTRIES)) {
      const name = path.split('/').pop()!;
      const e = ext(name);
      if (!ACCEPTED_EXTENSIONS.includes(e) || bytes.length === 0) {
        skipped.push(name);
        continue;
      }
      files.push(new File([bytes as BlobPart], name, { type: MIME[e] ?? 'application/octet-stream', lastModified: file.lastModified }));
    }
  }
  return { files, skipped };
}
