/**
 * Scanner de documents — pages capturées à l'appareil photo, assemblées en un
 * PDF unique, puis envoyées comme n'importe quelle pièce.
 *
 * Choix d'implémentation : uniquement des modules Expo maintenus (caméra,
 * manipulation d'image, impression PDF). Pas de module natif tiers à la
 * maintenance incertaine. Le cadrage est guidé par un gabarit à l'écran et
 * l'utilisateur peut recadrer, pivoter, réordonner et supprimer une page avant
 * de valider. Aucune image ne quitte l'appareil avant validation explicite.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Print from 'expo-print';
import { File, Paths } from 'expo-file-system';
import { log } from './logger';
import type { PickedFile } from './files';

export const MAX_PAGES = 20;

/** Largeur cible d'une page : lisible à l'écran et à l'impression, sans excès. */
const PAGE_WIDTH = 1600;
const PAGE_QUALITY = 0.72;

export type ScanPage = {
  /** Identifiant local (ordre / suppression). */
  id: string;
  uri: string;
  width: number;
  height: number;
};

/** Normalise une capture : redimensionnement, compression, rotation optionnelle. */
export async function preparePage(uri: string, rotate = 0): Promise<ScanPage> {
  const context = ImageManipulator.manipulate(uri);
  if (rotate) context.rotate(rotate);
  context.resize({ width: PAGE_WIDTH });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: PAGE_QUALITY, format: SaveFormat.JPEG });
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    uri: saved.uri,
    width: saved.width,
    height: saved.height,
  };
}

/** Fait pivoter une page déjà préparée (90° à chaque appel). */
export async function rotatePage(page: ScanPage): Promise<ScanPage> {
  const rotated = await preparePage(page.uri, 90);
  return { ...rotated, id: page.id };
}

async function asBase64(uri: string): Promise<string> {
  const file = new File(uri);
  return file.base64();
}

/**
 * Assemble les pages en un PDF A4 (une image par page, sans marge visible).
 * Le fichier est écrit dans le cache de l'application ; l'appelant l'envoie
 * puis appelle `discardScan()`.
 */
export async function buildPdf(pages: ScanPage[], baseName: string): Promise<PickedFile> {
  if (!pages.length) throw new Error('no-pages');
  const images = await Promise.all(pages.map((p) => asBase64(p.uri)));
  const body = images
    .map(
      (b64) =>
        `<div class="page"><img src="data:image/jpeg;base64,${b64}" alt="" /></div>`,
    )
    .join('');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  .page { width: 100%; height: 100vh; display: flex; align-items: center; justify-content: center; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  img { max-width: 100%; max-height: 100%; object-fit: contain; }
</style></head><body>${body}</body></html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false, width: 595, height: 842 });
  const name = `${baseName}.pdf`;
  const target = new File(Paths.cache, name);
  try {
    if (target.exists) target.delete();
  } catch {
    /* cache vide */
  }
  const source = new File(uri);
  await source.move(target);
  const size = target.size ?? 0;
  log.info('scan.pdf', `pages=${pages.length}`);
  return { uri: target.uri, name, size, mimeType: 'application/pdf' };
}

/** Efface les fichiers temporaires d'une session de scan. */
export function discardScan(pages: ScanPage[], pdf?: PickedFile | null): void {
  for (const page of pages) {
    try {
      new File(page.uri).delete();
    } catch {
      /* déjà nettoyé */
    }
  }
  if (pdf) {
    try {
      new File(pdf.uri).delete();
    } catch {
      /* déjà nettoyé */
    }
  }
}

/** Nom par défaut du PDF produit : lisible, daté, sans donnée personnelle. */
export function defaultScanName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `scan-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}
