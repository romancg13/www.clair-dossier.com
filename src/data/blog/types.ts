export type BlogContentBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'quote'; text: string; cite?: string }
  | { type: 'list'; items: string[] }
  | { type: 'callout'; text: string; tone?: 'gold' | 'navy' };

export type HowToStep = {
  name: string;
  text: string;
};

export type HowToSchema = {
  name: string;
  description: string;
  totalTime?: string; // ISO 8601 duration like PT30M
  steps: HowToStep[];
};

/**
 * Source officielle citée par un article. `checkedAt` = date à laquelle le
 * lien a réellement été consulté et le contenu vérifié (jamais « deviné »).
 */
export type BlogSource = {
  label: string;
  url: string;
  publisher: string;
  checkedAt: string; // YYYY-MM-DD
};

/**
 * Illustrations SVG originales et légères (src/components/journal/) —
 * aucune image distante, aucune vidéo.
 */
export type JournalIllustrationKey =
  | 'dossier'
  | 'archive'
  | 'shield'
  | 'timeline'
  | 'letter'
  | 'balance'
  | 'checklist'
  | 'compass';

/** `draft` = non listé, non routé, non pré-rendu (voir src/data/blog/index.ts). */
export type BlogPostStatus = 'published' | 'draft';

/**
 * Données éditoriales d'un article, telles qu'écrites dans src/data/blog/*.ts.
 * La durée de lecture n'y figure PAS : elle est calculée à partir du texte
 * (src/data/blog/reading.ts) et ajoutée par src/data/blog/index.ts.
 */
export type BlogPostInput = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  summary: string;
  author: string;
  /** Date de première publication — ne change jamais (URL et SEO). */
  date: string;
  /**
   * Date de la dernière révision SUBSTANTIELLE réellement effectuée
   * (fond, sources, corrections). Jamais pour une simple retouche.
   */
  updated?: string;
  /** Ce qui a changé lors de cette révision — affiché au lecteur. */
  revisionNote?: string;
  /** Date à laquelle l'article doit être relu (alerte admin, aucune republication automatique). */
  reviewBy: string;
  status?: BlogPostStatus;
  category: string;
  tags: string[];
  heroImageQuery?: string;
  illustration?: JournalIllustrationKey;
  content: BlogContentBlock[];
  takeaways: string[];
  faq?: Array<{ q: string; a: string }>;
  /** Optional HowTo structured data — emitted as JSON-LD HowTo. */
  howTo?: HowToSchema;
  /** Sources officielles vérifiées (affichées en fin d'article). */
  sources?: BlogSource[];
  relatedSlugs: string[];
};

/** Article prêt à l'affichage : durée de lecture et nombre de mots calculés. */
export type BlogPost = BlogPostInput & {
  readMinutes: number;
  wordCount: number;
};
