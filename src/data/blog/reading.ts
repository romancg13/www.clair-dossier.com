/**
 * Journal — fonctions pures (sans React, sans DOM) : durée de lecture
 * calculée à partir du texte, et alerte de révision éditoriale.
 *
 * Testées dans tests/journal.test.ts. Aucune republication automatique :
 * la liste des articles à revoir est une ALERTE destinée à un humain.
 */
import type { BlogContentBlock, BlogPostInput } from './types';

/** Vitesse de lecture retenue (fourchette usuelle 200–230 mots/min). */
export const WORDS_PER_MINUTE = 220;

/** Nombre de mots d'un texte : jetons contenant au moins une lettre ou un chiffre. */
export function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** Textes lisibles d'un bloc de contenu (titres compris). */
export function blockTexts(block: BlogContentBlock): string[] {
  switch (block.type) {
    case 'list':
      return block.items;
    case 'quote':
      return block.cite ? [block.text, block.cite] : [block.text];
    default:
      return [block.text];
  }
}

/** Mots du corps de l'article uniquement (blocs de contenu). */
export function bodyWordCount(post: Pick<BlogPostInput, 'content'>): number {
  return post.content.reduce(
    (sum, block) => sum + blockTexts(block).reduce((s, t) => s + countWords(t), 0),
    0
  );
}

/**
 * Mots réellement lus sur la page : résumé, corps, « À retenir » et FAQ.
 * (Les sources et la navigation ne sont pas comptées.)
 */
export function readableWordCount(
  post: Pick<BlogPostInput, 'summary' | 'content' | 'takeaways' | 'faq'>
): number {
  const extras = [
    post.summary,
    ...post.takeaways,
    ...(post.faq ?? []).flatMap((f) => [f.q, f.a]),
  ];
  return bodyWordCount(post) + extras.reduce((s, t) => s + countWords(t), 0);
}

/** Durée de lecture en minutes (arrondi supérieur, minimum 1). */
export function readingMinutes(words: number, wpm: number = WORDS_PER_MINUTE): number {
  if (!Number.isFinite(words) || words <= 0) return 1;
  return Math.max(1, Math.ceil(words / wpm));
}

// ── Alerte de révision ─────────────────────────────────────────────────

export type ReviewAlert = {
  slug: string;
  title: string;
  status: 'published' | 'draft';
  reviewBy: string;
  /** Jours restants avant l'échéance (négatif = en retard). */
  daysLeft: number;
  level: 'overdue' | 'due-soon';
  /** Dernière date de révision connue (mise à jour, sinon publication). */
  lastRevised: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Convertit une date ISO YYYY-MM-DD (ou un Date) en jour UTC — sans fuseau local. */
function toUtcDay(value: string | Date): number {
  if (value instanceof Date) {
    return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new Error(`Date invalide (attendu YYYY-MM-DD) : ${value}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Articles à revoir : échéance `reviewBy` dépassée (overdue) ou atteinte
 * dans les `horizonDays` prochains jours (due-soon). Triés du plus urgent
 * au moins urgent. Inclut les brouillons (ils attendent un arbitrage).
 */
export function postsToReview(
  posts: ReadonlyArray<Pick<BlogPostInput, 'slug' | 'title' | 'reviewBy' | 'status' | 'date' | 'updated'>>,
  today: string | Date,
  horizonDays = 30
): ReviewAlert[] {
  const now = toUtcDay(today);
  return posts
    .map((p) => {
      const daysLeft = Math.round((toUtcDay(p.reviewBy) - now) / DAY_MS);
      return {
        slug: p.slug,
        title: p.title,
        status: p.status ?? 'published',
        reviewBy: p.reviewBy,
        daysLeft,
        level: daysLeft < 0 ? ('overdue' as const) : ('due-soon' as const),
        lastRevised: p.updated ?? p.date,
      };
    })
    .filter((a) => a.daysLeft <= horizonDays)
    .sort((a, b) => a.daysLeft - b.daysLeft || a.slug.localeCompare(b.slug));
}
