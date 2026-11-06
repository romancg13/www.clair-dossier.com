/**
 * Garde-fous SEO du site public (standard web-seo-local-google-ia) — cité par
 * scripts/prerender.ts et src/data/routes.ts. Aucun accès réseau.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { canonicalPath, softwareApplicationSchema, orgSchema } from '../src/lib/seo.tsx';
import { plans } from '../src/data/pricing.ts';
import { PHONE_E164 } from '../src/data/contact.ts';
import { Accordion } from '../src/components/ui/Accordion.tsx';

const frozen = new Set<string>(Object.keys(JSON.parse(readFileSync('tests/paiements-geles.json', 'utf8')).fichiers));

test('canonicalPath : barre finale pour les pages, jamais pour les fichiers', () => {
  assert.equal(canonicalPath('/'), '/');
  assert.equal(canonicalPath('/tarifs'), '/tarifs/');
  assert.equal(canonicalPath('/tarifs/'), '/tarifs/');
  assert.equal(canonicalPath('/blog/mise-en-demeure?x=1#a'), '/blog/mise-en-demeure/');
  assert.equal(canonicalPath('/sitemap.xml'), '/sitemap.xml');
});

test('SoftwareApplication : prix publics, sans « HT » ni LegalService (TVA non applicable, CGV)', () => {
  const schema = softwareApplicationSchema(plans.map((p) => p.priceMonthly));
  const json = JSON.stringify(schema);
  assert.equal(schema.applicationCategory, 'BusinessApplication');
  assert.ok(!/\bHT\b/.test(json), 'aucune mention HT dans le JSON-LD');
  assert.ok(!json.includes('LegalService'));
  assert.ok(!json.includes('aggregateRating') && !json.includes('"review"'));
  const offers = (schema as { offers?: { lowPrice: string; highPrice: string } }).offers;
  assert.ok(offers, 'offre agrégée attendue');
  const paid = plans.map((p) => p.priceMonthly).filter((p): p is number => typeof p === 'number' && p > 0);
  assert.equal(offers.lowPrice, String(Math.min(...paid)));
  assert.equal(offers.highPrice, String(Math.max(...paid)));
});

test('Organization : téléphone officiel, pas de LocalBusiness', () => {
  assert.equal(orgSchema.telephone, PHONE_E164);
  assert.equal(orgSchema['@type'], 'Organization');
});

test('accueil : JSON-LD construit par le constructeur commun (aucun « HT » codé en dur)', () => {
  for (const f of ['src/components/landing/HomeCinematic.tsx', 'src/pages/Home.tsx']) {
    const src = readFileSync(f, 'utf8');
    assert.ok(src.includes('softwareApplicationSchema('), `${f} : softwareApplicationSchema attendu`);
    assert.ok(!src.includes("applicationCategory: 'LegalService'") && !src.includes('applicationCategory: "LegalService"'), f);
  }
});

test('FAQ : toutes les réponses sont présentes dans le HTML rendu côté serveur', () => {
  const items = [
    { id: 'a', question: 'Question A', answer: 'Réponse A visible' },
    { id: 'b', question: 'Question B', answer: 'Réponse B fermée mais présente' },
  ];
  const html = renderToStaticMarkup(createElement(Accordion, { items }));
  assert.ok(html.includes('Réponse A visible'));
  assert.ok(html.includes('Réponse B fermée mais présente'), 'réponse fermée absente du HTML');
  assert.ok(/aria-hidden="true"/.test(html), 'panneau fermé marqué aria-hidden');
});

test('liens internes : forme canonique /page/ (évite une redirection 301 par clic)', () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(n)) files.push(p);
    }
  };
  walk('src');
  const PRIVATE = /^\/(compte|dossier|admin|corbeille|connexion|inscription|investisseurs|v\/?$)/;
  const offenders: string[] = [];
  for (const f of files) {
    if (frozen.has(f) || f === 'src/data/routes.ts' || f === 'src/lib/seo.tsx') continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\b(?:to|href)\s*(?:=\s*\{?|:\s*)(["'`])(\/[^"'`]*)\1/g)) {
      const base = m[2].split(/[?#]/)[0];
      if (base === '/' || base.endsWith('/') || PRIVATE.test(base) || /\.[a-z0-9]{2,5}$/i.test(base)) continue;
      offenders.push(`${f} : ${m[2]}`);
    }
  }
  assert.deepEqual(offenders, [], `liens sans barre finale :\n${offenders.join('\n')}`);
});

test('configuration seo-check valide et alignée sur le code', () => {
  const cfg = JSON.parse(readFileSync('seo/site.config.json', 'utf8'));
  assert.equal(cfg.canonicalOrigin, 'https://www.clair-dossier.com');
  assert.equal(cfg.phone.e164, PHONE_E164);
  assert.equal(cfg.trailingSlash, 'always');
  const key = cfg.indexnow.key as string;
  assert.match(key, /^[0-9a-f]{32}$/);
  assert.equal(readFileSync(`public/${key}.txt`, 'utf8'), key, 'fichier de clé IndexNow publié');
});

test('fichiers markdown publics générés : prix sans « HT » (TVA non applicable, art. 293 B)', () => {
  const src = readFileSync('scripts/gen-markdown.ts', 'utf8');
  assert.ok(!/€\/mois HT|€ HT\/mois|HT\/an/.test(src));
});
