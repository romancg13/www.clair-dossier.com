import { useEffect } from 'react';
import { CONTACT_EMAIL, PHONE_E164, SIEGE } from '../data/contact';

type SeoProps = {
  title: string;
  description: string;
  path?: string;
  type?: 'website' | 'article';
  image?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
};

export const SITE_URL = 'https://www.clair-dossier.com';
const SITE_NAME = 'ClairDossier';
const TAGLINE = 'Dossier juridique clair, structuré et suivi';
/** Au-delà, Google tronque le titre : la signature longue cède la place à « — ClairDossier ». */
const TITLE_MAX = 70;

/**
 * Espaces privés et écrans d'authentification : jamais indexés, jamais au
 * sitemap, jamais pré-rendus. (robots.txt n'est pas une protection : l'accès
 * réel est contrôlé par l'authentification et les règles RLS de la base.)
 */
export const PRIVATE_PATH_PREFIXES = [
  '/compte',
  '/dossier',
  '/admin',
  '/corbeille',
  '/connexion',
  '/inscription',
] as const;

export function isPrivatePath(path: string): boolean {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return PRIVATE_PATH_PREFIXES.some((p) => clean === p || clean.startsWith(`${p}/`));
}

/**
 * Chemin canonique : GitHub Pages sert chaque page pré-rendue sous /route/
 * (dist/route/index.html) et redirige /route → /route/ en 301. La canonique,
 * og:url, le fil d'Ariane JSON-LD et le sitemap pointent donc vers la forme
 * finale avec barre oblique — jamais vers une URL qui redirige.
 */
export function canonicalPath(path: string): string {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, '');
  if (clean === '') return '/';
  const withLead = clean.startsWith('/') ? clean : `/${clean}`;
  // Fichier (sitemap.xml, brochure.pdf…) : pas de barre finale.
  return /\.[a-z0-9]+$/i.test(withLead) ? withLead : `${withLead}/`;
}

export function canonicalUrl(path: string): string {
  return `${SITE_URL}${canonicalPath(path)}`;
}

/** Titre complet : signature longue si elle tient, sinon « Titre — ClairDossier ». */
export function formatTitle(title: string): string {
  if (title.includes(SITE_NAME)) return title;
  const long = `${title} — ${SITE_NAME} · ${TAGLINE}`;
  return long.length <= TITLE_MAX ? long : `${title} — ${SITE_NAME}`;
}

// ── Pré-rendu (SSG) : collecte des métadonnées au rendu serveur ──────────
// Pendant le pré-rendu (scripts/prerender.ts via src/entry-server.tsx), les
// useEffect ne s'exécutent pas : le composant <Seo> enregistre donc ses
// métadonnées résolues auprès de ce collecteur au moment du rendu. Inactif
// (et éliminé du bundle) côté client.
export type CollectedSeo = {
  title: string;
  description: string;
  url: string;
  type: 'website' | 'article';
  image: string;
  noindex: boolean;
  jsonLd: Record<string, unknown>[];
};

let ssrSeoCollector: ((seo: CollectedSeo) => void) | null = null;

/** Réservé au pré-rendu — voir src/entry-server.tsx. */
export function setSsrSeoCollector(fn: ((seo: CollectedSeo) => void) | null): void {
  ssrSeoCollector = fn;
}

function upsertMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

export function Seo({
  title,
  description,
  path = '/',
  type = 'website',
  image = '/og-default.jpg',
  jsonLd,
  noindex: noindexProp = false,
}: SeoProps) {
  const fullTitle = formatTitle(title);
  const url = canonicalUrl(path);
  // Garde-fou : une route privée n'est jamais indexable, même si la page
  // oublie de le demander (ex. /dossier/nouveau).
  const noindex = noindexProp || isPrivatePath(path);
  const absImage = image.startsWith('http') ? image : `${SITE_URL}${image}`;

  if (import.meta.env.SSR) {
    ssrSeoCollector?.({
      title: fullTitle,
      description,
      url,
      type,
      image: absImage,
      noindex,
      jsonLd: jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [],
    });
  }

  useEffect(() => {
    document.title = fullTitle;
    upsertMeta('meta[name="description"]', 'name', 'description', description);
    upsertMeta(
      'meta[name="robots"]',
      'name',
      'robots',
      noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'
    );
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', url);
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', type);
    upsertMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_NAME);
    upsertMeta('meta[property="og:locale"]', 'property', 'og:locale', 'fr_FR');
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', absImage);
    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', absImage);

    // Page non indexable (404, espaces privés) : aucune canonique — une
    // canonique vers l'accueil ferait passer la 404 pour un doublon de celui-ci.
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (noindex) {
      canonical?.remove();
    } else {
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = url;
    }

    document.head.querySelectorAll('script[data-seo-jsonld="true"]').forEach((n) => n.remove());
    if (jsonLd) {
      const arr = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      arr.forEach((data) => {
        const s = document.createElement('script');
        s.type = 'application/ld+json';
        s.dataset.seoJsonld = 'true';
        s.textContent = JSON.stringify(data);
        document.head.appendChild(s);
      });
    }
  }, [fullTitle, description, url, type, absImage, jsonLd, noindex]);

  return null;
}

// ─── JSON-LD builders ────────────────────────────────────────
// Règle : chaque propriété reflète un contenu publié et vérifiable (mentions
// légales, page contact, tarifs). Aucun avis, note, prix ou date inventés.
//
// Pas de LocalBusiness : ClairDossier est un service en ligne, sans local
// recevant du public ni horaires d'accueil ; le siège publié se limite à
// « Château-Gombert, 13013 Marseille », sans adresse de rue. Le type
// Organization avec adresse postale (localité, code postal) est donc le
// balisage fidèle. (foundingDate retiré : aucune source publiée.)
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;

export const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE_URL}/icon-512.png`,
    width: 512,
    height: 512,
  },
  description:
    "ClairDossier est une plateforme legaltech française qui aide à constituer, structurer et suivre des dossiers administratifs et juridiques, transmis par l'utilisateur, sur sa validation. Elle ne se substitue pas à un professionnel du droit.",
  telephone: PHONE_E164,
  email: CONTACT_EMAIL,
  // Siège publié dans les mentions légales (Château-Gombert, 13013 Marseille) —
  // source unique : src/data/contact.ts (NAP cohérent avec /marseille et le pied de page).
  address: {
    '@type': 'PostalAddress',
    ...SIEGE,
  },
  areaServed: 'FR',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    telephone: PHONE_E164,
    email: CONTACT_EMAIL,
    availableLanguage: ['French'],
    areaServed: 'FR',
  },
};

// SearchAction retiré : le journal ne propose pas de recherche (?q= sans effet).
export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  inLanguage: 'fr-FR',
  publisher: { '@id': ORGANIZATION_ID },
};

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}

/**
 * SoftwareApplication — l'application web ClairDossier. Les prix sont ceux
 * passés par l'appelant (src/data/pricing.ts : mensualités publiques, hors
 * sur-mesure), sans remise temporaire, sans note ni avis. TVA non applicable
 * (art. 293 B du CGI) : le prix affiché est le prix payé — jamais « HT ».
 */
export function softwareApplicationSchema(monthlyPrices: ReadonlyArray<number | null>) {
  const prices = monthlyPrices.filter((p): p is number => typeof p === 'number' && p > 0);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: 'fr-FR',
    description:
      "Application web pour réunir ses pièces dans un espace privé, structurer ses dossiers administratifs et juridiques et suivre leurs échéances. Rien n'est transmis sans la validation de l'utilisateur.",
    publisher: { '@type': 'Organization', '@id': ORGANIZATION_ID, name: SITE_NAME },
    ...(prices.length > 0
      ? {
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'EUR',
            lowPrice: String(Math.min(...prices)),
            highPrice: String(Math.max(...prices)),
            offerCount: String(prices.length),
            url: canonicalUrl('/tarifs'),
          },
        }
      : {}),
  };
}
