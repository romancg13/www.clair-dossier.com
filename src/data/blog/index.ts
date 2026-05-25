import { chronologiePrudHomale } from './chronologie-prud-homale';
import { iaDroit } from './ia-droit';
import { rgpdLegaltech } from './rgpd-legaltech';
import type { BlogPost } from './types';

export const blogPosts: BlogPost[] = [
  chronologiePrudHomale,
  iaDroit,
  rgpdLegaltech,
];

export function getPostBySlug(slug: string | undefined): BlogPost | undefined {
  if (!slug) return undefined;
  return blogPosts.find((p) => p.slug === slug);
}

export function getRelatedPosts(post: BlogPost): BlogPost[] {
  return post.relatedSlugs
    .map((slug) => getPostBySlug(slug))
    .filter((p): p is BlogPost => Boolean(p));
}

export type { BlogPost, BlogContentBlock } from './types';
