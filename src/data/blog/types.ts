export type BlogContentBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'quote'; text: string; cite?: string }
  | { type: 'list'; items: string[] }
  | { type: 'callout'; text: string; tone?: 'gold' | 'navy' };

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
  relatedSlugs: string[];
};
