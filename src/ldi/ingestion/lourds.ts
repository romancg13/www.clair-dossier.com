/**
 * LDI — extracteurs à dépendance lourde, chargés paresseusement.
 *
 * ┌─ POURQUOI CE FICHIER EST SÉPARÉ ────────────────────────────────────────┐
 * │ `pdfjs-dist` pèse 124 Ko gz plus un worker de 365 Ko ; `postal-mime`     │
 * │ 22 Ko. Les importer statiquement les ferait entrer dans le bundle de     │
 * │ l'atelier, que l'avocat télécharge même s'il ne fait qu'ouvrir son       │
 * │ tableau de bord.                                                         │
 * │                                                                          │
 * │ Chaque fonction ici fait donc son `import()` au moment où un fichier du  │
 * │ format concerné est réellement déposé. C'est la décision qui rend le     │
 * │ chantier d'ingestion acceptable pour une application qui doit démarrer   │
 * │ hors ligne — voir `docs/DEPENDANCES.md`.                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Ces deux extracteurs ne font AUCUN appel réseau : les bibliothèques sont
 * empaquetées avec l'application, pas chargées depuis un CDN. C'est ce qui les
 * distingue de la reconnaissance optique, écartée pour cette raison précise.
 */
import { page } from './extracteurs';
import { empreinteContenu } from './ingestion';
import { reconnaitreFormat } from './formats';
import type { BornesIngestion, PageExtraite, PieceIngeree } from './types';

/**
 * Texte d'un PDF, une entrée par page.
 *
 * Une page sans couche texte n'est pas une page vide : c'est une page scannée,
 * que seule une reconnaissance optique pourrait lire. Elle part en quarantaine
 * avec ce motif, pour que l'avocat sache qu'elle existe et qu'elle n'a pas été
 * lue — la confondre avec une page blanche serait perdre une pièce.
 */
export async function extrairePdf(
  octets: Uint8Array,
  bornes: BornesIngestion
): Promise<PageExtraite[]> {
  const pdfjs = await import('pdfjs-dist');

  // Le worker est fourni par le bundle, jamais par un CDN.
  const { default: WorkerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = WorkerUrl as unknown as string;

  // Aucune ressource distante. `cMapUrl` et `standardFontDataUrl` sont
  // volontairement absents : non renseignés, pdfjs ne va rien chercher. Leur
  // absence dégrade le rendu de certaines polices — sans effet ici, où l'on
  // n'extrait que du texte et où l'on n'affiche aucune page.
  //
  // Rien n'est prévu pour désactiver l'évaluation de code : pdfjs 6 l'a
  // retirée du moteur, ce qui vaut mieux qu'une option qu'on pourrait oublier.
  const tache = pdfjs.getDocument({
    data: octets,
    useWorkerFetch: false,
    isOffscreenCanvasSupported: false,
  });
  const document = await tache.promise;

  const pages: PageExtraite[] = [];

  for (let n = 1; n <= document.numPages; n += 1) {
    const p = await document.getPage(n);
    const contenu = await p.getTextContent();

    const texte = contenu.items
      .map((item) => ('str' in item ? item.str : ''))
      .join('')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    pages.push(
      page(
        n,
        texte,
        texte.length > 0 ? 'couche-texte' : 'aucune',
        texte.length > 0 ? 1 : 0,
        bornes.seuilConfiance,
        texte.length === 0
          ? "Page sans couche texte : probablement numérisée. La reconnaissance optique n'est pas installée (voir docs/DEPENDANCES.md) — la page n'a pas été lue."
          : ''
      )
    );
  }

  // La destruction porte sur la tâche de chargement : c'est elle qui détient
  // le worker, et le laisser en vie retiendrait le document en mémoire.
  await tache.destroy();
  return pages;
}

/**
 * Courriel `.eml` : en-têtes, corps, et pièces jointes extraites comme pièces
 * à part entière.
 *
 * Une pièce jointe n'est pas une annexe du courriel : c'est une pièce du
 * dossier, qui doit porter sa propre cote et entrer dans le bordereau. La
 * traiter comme un attribut du message la rendrait invisible au classement.
 */
export async function extraireCourriel(
  nom: string,
  octets: Uint8Array,
  bornes: BornesIngestion
): Promise<{ pages: PageExtraite[]; derivees: PieceIngeree[] }> {
  const { default: PostalMime } = await import('postal-mime');
  const message = await new PostalMime().parse(octets);

  const entetes = [
    `De : ${adresse(message.from)}`,
    `À : ${(message.to ?? []).map(adresse).join(', ')}`,
    message.cc?.length ? `Copie : ${message.cc.map(adresse).join(', ')}` : '',
    `Date : ${message.date ?? '[INFORMATION MANQUANTE]'}`,
    `Objet : ${message.subject ?? '[INFORMATION MANQUANTE]'}`,
  ].filter(Boolean);

  const corps = (message.text ?? sansBalises(message.html ?? '')).trim();
  const texte = `${entetes.join('\n')}\n\n${corps}`;

  const derivees: PieceIngeree[] = (message.attachments ?? []).map((piece) => {
    const contenu =
      piece.content instanceof ArrayBuffer
        ? new Uint8Array(piece.content)
        : new TextEncoder().encode(String(piece.content ?? ''));
    const nomPiece = piece.filename ?? 'pièce jointe sans nom';

    return {
      empreinte: empreinteContenu(contenu),
      nomFichier: nomPiece,
      chemin: `${nom}/pièces jointes`,
      format: reconnaitreFormat(nomPiece, contenu),
      octets: contenu.length,
      // Le contenu n'est pas extrait ici : la pièce est renvoyée à l'ingestion,
      // qui applique les mêmes bornes et la même quarantaine qu'à tout fichier.
      pages: [
        page(
          1,
          '',
          'aucune',
          0,
          bornes.seuilConfiance,
          'Pièce jointe détachée du courriel : à ingérer comme pièce autonome.'
        ),
      ],
      derivees: [],
      avertissements: [],
    };
  });

  return {
    pages: [page(1, texte, 'mime', corps.length > 0 ? 1 : 0.3, bornes.seuilConfiance,
      corps.length === 0 ? 'Corps du message vide ou illisible.' : '')],
    derivees,
  };
}

function adresse(a: { name?: string; address?: string } | undefined | null): string {
  if (!a) return '[INFORMATION MANQUANTE]';
  return a.name ? `${a.name} <${a.address ?? ''}>` : (a.address ?? '[INFORMATION MANQUANTE]');
}

/** Réduit un corps HTML à son texte, sans analyseur : on ne rend pas la page. */
function sansBalises(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n');
}
