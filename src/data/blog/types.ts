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

export type BlogPost = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  summary: string;
  author: string;
  date: string;
  readMinutes: number;
  category: string;
  tags: string[];
  heroImageQuery: string;
  content: BlogContentBlock[];
  takeaways: string[];
  faq?: Array<{ q: string; a: string }>;
  /** Optional HowTo structured data — emitted as JSON-LD HowTo. */
  howTo?: HowToSchema;
  relatedSlugs: string[];
};
