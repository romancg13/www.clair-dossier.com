import { chronologiePrudHomale } from './chronologie-prud-homale';
import { conservationDocuments } from './conservation-documents';
import { iaDroit } from './ia-droit';
import { mediationContentieux } from './mediation-contentieux';
import { miseEnDemeure } from './mise-en-demeure';
import { organiserUnDossier } from './organiser-un-dossier';
import { preparerRendezVousAvocat } from './preparer-rendez-vous-avocat';
import { readableWordCount, readingMinutes, postsToReview } from './reading';
import { rgpdLegaltech } from './rgpd-legaltech';
import type { BlogPost, BlogPostInput } from './types';

const ALL: BlogPostInput[] = [
  organiserUnDossier,
  preparerRendezVousAvocat,
  chronologiePrudHomale,
  rgpdLegaltech,
  miseEnDemeure,
  conservationDocuments,
  mediationContentieux,
  iaDroit,
];

function withReading(post: BlogPostInput): BlogPost {
  const wordCount = readableWordCount(post);
  return { ...post, wordCount, readMinutes: readingMinutes(wordCount) };
}

// Articles publiés (les brouillons ne sont ni listés, ni routés, ni pré-rendus),
// du plus récent au plus ancien selon la date de première publication.
export const blogPosts: BlogPost[] = ALL.filter((p) => (p.status ?? 'published') === 'published')
  .map(withReading)
  .sort((a, b) => b.date.localeCompare(a.date));

/** Alerte de révision éditoriale (brouillons compris) — destinée à l'administration. */
export function journalReviewAlerts(today: string | Date, horizonDays = 30) {
  return postsToReview(ALL, today, horizonDays);
}

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
