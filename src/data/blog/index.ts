import { chronologiePrudHomale } from './chronologie-prud-homale';
import { conservationDocuments } from './conservation-documents';
import { iaDroit } from './ia-droit';
import { mediationContentieux } from './mediation-contentieux';
import { miseEnDemeure } from './mise-en-demeure';
import { preparerRendezVousAvocat } from './preparer-rendez-vous-avocat';
import { rgpdLegaltech } from './rgpd-legaltech';
import type { BlogPost } from './types';

// Tri descendant par date de publication — les plus récents en premier.
export const blogPosts: BlogPost[] = [
  preparerRendezVousAvocat, // 2026-05-20
  chronologiePrudHomale,    // 2026-05-12 (existant)
  miseEnDemeure,            // 2026-04-15
  conservationDocuments,    // 2026-03-28
  mediationContentieux,     // 2026-02-12
  rgpdLegaltech,            // (existant — date dans le fichier)
  iaDroit,                  // (existant — date dans le fichier)
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
