import { useEffect } from 'react';

type SeoProps = {
  title: string;
  description: string;
  path?: string;
  type?: 'website' | 'article';
  image?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
};

const SITE_URL = 'https://www.clair-dossier.com';
const SITE_NAME = 'ClairDossier';

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
  noindex = false,
}: SeoProps) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME} · Dossier juridique clair, structuré et suivi`;
  const url = `${SITE_URL}${path}`;
  const absImage = image.startsWith('http') ? image : `${SITE_URL}${image}`;
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : '';

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

    // Pas de canonique sur une page noindex (signaux contradictoires — et le
    // 404 pointait l'accueil, transformant toute URL inconnue en soft-404).
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
    // jsonLd est comparé par valeur sérialisée : les appelants passent un
    // littéral neuf à chaque rendu, qui purgeait/réinjectait les <script>
    // JSON-LD à chaque re-render.
  }, [title, description, path, type, image, jsonLdKey, noindex]);

  return null;
}

// ─── JSON-LD builders ────────────────────────────────────────
export const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.svg`,
  description:
    "ClairDossier est une plateforme legaltech française qui aide à constituer, structurer et suivre des dossiers administratifs et juridiques, transmis sur validation de l'utilisateur. Elle ne se substitue pas à un professionnel du droit.",
  foundingDate: '2025',
  telephone: '+33491959032',
  email: 'contact.clairdossier@icloud.com',
  // Siège publié dans les mentions légales (Château-Gombert, 13013 Marseille).
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Marseille',
    postalCode: '13013',
    addressRegion: 'Bouches-du-Rhône',
    addressCountry: 'FR',
  },
  areaServed: 'FR',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    telephone: '+33491959032',
    email: 'contact.clairdossier@icloud.com',
    availableLanguage: ['French'],
    areaServed: 'FR',
  },
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: 'fr-FR',
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/blog?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
