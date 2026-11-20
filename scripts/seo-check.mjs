#!/usr/bin/env node
// seo-check — moteur SEO commun (standard web-seo-local-google-ia).
// Zéro dépendance, Node >= 20. Un seul fichier, copiable tel quel dans un projet
// (scripts/seo-check.mjs). Configuration : seo/site.config.json.
//
//   node scripts/seo-check.mjs check [--config seo/site.config.json] [--base URL | --dist DIR]
//                                    [--deep] [--json out.json] [--fail-on bloquant|majeur]
//   node scripts/seo-check.mjs report --in a.json [--in b.json] [--md out.md]
//   node scripts/seo-check.mjs init  [--site cle --origin https://exemple.fr]
//   node scripts/seo-check.mjs indexnow --config … [--ledger seo/state/indexnow.json] [--dry-run]
//
// Gravités : « bloquant » (régression critique : code de sortie 1), « majeur », « mineur ».
// Les recommandations éditoriales ne bloquent jamais.

import { readFile, writeFile, mkdir, readdir, stat, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';

export const VERSION = '1.0.0';
const UA_DEFAULT = 'Mozilla/5.0 (compatible; seo-check/1.0; +https://clairnova.fr)';
const BOT_UAS = {
  Googlebot: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  Bingbot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116.0.1938.76 Safari/537.36',
  'OAI-SearchBot': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot',
  PerplexityBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  GPTBot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot',
};

// ───────────────────────── configuration ─────────────────────────

const DEFAULT_LIMITS = { maxPages: 200, concurrency: 4, timeoutMs: 15000, maxRedirectHops: 2, deepLinkLimit: 400 };

export class ConfigError extends Error {}

/** Valide la configuration et renvoie une copie normalisée (erreurs explicites). */
export function validateConfig(raw) {
  const errs = [];
  const c = raw && typeof raw === 'object' ? structuredClone(raw) : {};
  const isStr = (v) => typeof v === 'string' && v.length > 0;
  const strArr = (k) => {
    if (c[k] === undefined) { c[k] = []; return; }
    if (!Array.isArray(c[k]) || !c[k].every(isStr)) errs.push(`${k} : tableau de chaînes attendu`);
  };
  if (c.version !== 1) errs.push('version : 1 attendu');
  if (!isStr(c.site) || !/^[a-z0-9-]+$/.test(c.site)) errs.push('site : identifiant [a-z0-9-] attendu');
  if (!isStr(c.canonicalOrigin)) errs.push('canonicalOrigin : URL attendue');
  else {
    try {
      const u = new URL(c.canonicalOrigin);
      if (u.protocol !== 'https:' || u.pathname !== '/' || u.search || u.hash) errs.push('canonicalOrigin : origine https sans chemin attendue');
      c.canonicalOrigin = u.origin;
    } catch { errs.push('canonicalOrigin : URL invalide'); }
  }
  if (c.trailingSlash === undefined) c.trailingSlash = 'any';
  if (!['always', 'never', 'any'].includes(c.trailingSlash)) errs.push('trailingSlash : always | never | any');
  for (const k of ['alternateHosts', 'sitemaps', 'publicRoutes', 'privatePaths', 'privateProbe']) strArr(k);
  if (!c.sitemaps?.length) c.sitemaps = ['/sitemap.xml'];
  if (c.notFoundProbe === undefined) c.notFoundProbe = '/__seo-check-404__';
  if (!isStr(c.notFoundProbe) || !c.notFoundProbe.startsWith('/')) errs.push('notFoundProbe : chemin attendu');
  if (c.legacyRedirects === undefined) c.legacyRedirects = [];
  if (!Array.isArray(c.legacyRedirects) || !c.legacyRedirects.every((r) => isStr(r?.from) && isStr(r?.to))) errs.push('legacyRedirects : [{from, to}] attendu');
  if (c.forbiddenPatterns === undefined) c.forbiddenPatterns = [];
  if (!Array.isArray(c.forbiddenPatterns)) errs.push('forbiddenPatterns : tableau attendu');
  else for (const [i, p] of c.forbiddenPatterns.entries()) {
    if (!isStr(p?.pattern) || !isStr(p?.reason)) { errs.push(`forbiddenPatterns[${i}] : {pattern, reason} attendu`); continue; }
    try { new RegExp(p.pattern, p.flags ?? 'i'); } catch { errs.push(`forbiddenPatterns[${i}] : expression invalide`); }
  }
  if (c.requiredText === undefined) c.requiredText = [];
  if (!Array.isArray(c.requiredText) || !c.requiredText.every((r) => isStr(r?.path) && isStr(r?.pattern))) errs.push('requiredText : [{path, pattern}] attendu');
  if (c.forms === undefined) c.forms = [];
  if (!Array.isArray(c.forms) || !c.forms.every((f) => isStr(f?.path))) errs.push('forms : [{path, contains?}] attendu');
  if (c.phone !== undefined) {
    if (!isStr(c.phone?.e164) || !/^\+\d{8,15}$/.test(c.phone.e164)) errs.push('phone.e164 : format +33… attendu');
    if (c.phone?.display !== undefined && (!Array.isArray(c.phone.display) || !c.phone.display.every(isStr))) errs.push('phone.display : tableau de chaînes');
  }
  c.structuredData = { forbiddenTypes: ['AggregateRating', 'Review'], requireOn: {}, ...(c.structuredData ?? {}) };
  if (!Array.isArray(c.structuredData.forbiddenTypes)) errs.push('structuredData.forbiddenTypes : tableau attendu');
  c.bots = { mustAllow: ['Googlebot', 'Bingbot'], shouldAllow: ['OAI-SearchBot', 'PerplexityBot'], ...(c.bots ?? {}) };
  for (const k of ['mustAllow', 'shouldAllow']) {
    if (!Array.isArray(c.bots[k]) || !c.bots[k].every((b) => BOT_UAS[b])) errs.push(`bots.${k} : valeurs parmi ${Object.keys(BOT_UAS).join(', ')}`);
  }
  c.limits = { ...DEFAULT_LIMITS, ...(c.limits ?? {}) };
  for (const [k, v] of Object.entries(c.limits)) if (!Number.isInteger(v) || v < 1) errs.push(`limits.${k} : entier positif attendu`);
  if (errs.length) throw new ConfigError(`Configuration invalide :\n- ${errs.join('\n- ')}`);
  return c;
}

export async function loadConfig(file) {
  let txt;
  try { txt = await readFile(file, 'utf8'); } catch { throw new ConfigError(`Configuration introuvable : ${file} (lancer « seo-check init »)`); }
  let json;
  try { json = JSON.parse(txt); } catch (e) { throw new ConfigError(`JSON invalide dans ${file} : ${e.message}`); }
  return validateConfig(json);
}

// ───────────────────────── HTML ─────────────────────────

const decode = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

function attrs(tag) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const inner = tag.replace(/^<\s*[a-zA-Z0-9-]+/, '').replace(/\/?>$/, '');
  let m;
  while ((m = re.exec(inner))) out[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? m[5] ?? '');
  return out;
}

/** Extrait les signaux SEO d'un document HTML (sans exécuter de JavaScript). */
export function parseHtml(html) {
  const noComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const head = (noComments.match(/<head[\s>][\s\S]*?<\/head>/i) ?? [noComments])[0];
  const tags = (re, src = noComments) => [...src.matchAll(re)].map((m) => m[0]);
  const metas = tags(/<meta\b[^>]*>/gi, head).map(attrs);
  const links = tags(/<link\b[^>]*>/gi, head).map(attrs);
  const metaBy = (k, v) => metas.find((m) => (m[k] ?? '').toLowerCase() === v)?.content;
  const title = (head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null);
  const htmlTag = noComments.match(/<html\b[^>]*>/i)?.[0];
  const jsonLd = [];
  for (const m of noComments.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const a = attrs(`<script ${m[1]}>`);
    if ((a.type ?? '').toLowerCase() !== 'application/ld+json') continue;
    try { jsonLd.push({ ok: true, data: JSON.parse(m[2].trim()) }); } catch (e) { jsonLd.push({ ok: false, error: e.message }); }
  }
  const body = (noComments.match(/<body[\s>][\s\S]*<\/body>/i) ?? [noComments])[0];
  const visible = decode(body
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  const h1 = tags(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, body).map((h) => decode(h.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim());
  const anchors = tags(/<a\b[^>]*>/gi, body).map(attrs).filter((a) => a.href !== undefined);
  const imgs = tags(/<img\b[^>]*>/gi, body).map(attrs);
  const robotsMeta = metas.filter((m) => ['robots', 'googlebot'].includes((m.name ?? '').toLowerCase())).map((m) => (m.content ?? '').toLowerCase());
  return {
    title: title === null ? null : decode(title).replace(/\s+/g, ' ').trim(),
    description: metaBy('name', 'description') ?? null,
    canonical: links.find((l) => (l.rel ?? '').toLowerCase().split(/\s+/).includes('canonical'))?.href ?? null,
    robots: robotsMeta.join(','),
    lang: htmlTag ? attrs(htmlTag).lang ?? null : null,
    h1,
    jsonLd,
    visibleText: visible,
    anchors: anchors.map((a) => ({ href: a.href, rel: a.rel ?? '' })),
    imagesWithoutAlt: imgs.filter((i) => i.alt === undefined).length,
    imageCount: imgs.length,
    hasForm: /<form\b/i.test(body),
    raw: noComments,
  };
}

/** Aplatis les nœuds JSON-LD (@graph, tableaux, objets imbriqués). */
export function jsonLdNodes(blocks) {
  const out = [];
  const walk = (n) => {
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!n || typeof n !== 'object') return;
    if (n['@type']) out.push(n);
    for (const [k, v] of Object.entries(n)) if (k !== '@context' && typeof v === 'object') walk(v);
  };
  for (const b of blocks) if (b.ok) walk(b.data);
  return out;
}
const typesOf = (n) => (Array.isArray(n['@type']) ? n['@type'] : [n['@type']]).map(String);
export const normPhone = (p) => {
  const d = String(p).replace(/[^\d+]/g, '');
  if (d.startsWith('+')) return d;
  if (d.startsWith('00')) return `+${d.slice(2)}`;
  if (d.startsWith('0') && d.length === 10) return `+33${d.slice(1)}`;
  return d;
};

// ───────────────────────── robots.txt ─────────────────────────

export function parseRobots(txt) {
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  const sitemaps = [];
  for (const line0 of txt.split(/\r?\n/)) {
    const line = line0.replace(/#.*$/, '').trim();
    if (!line) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line.slice(i + 1).trim();
    if (k === 'sitemap') { sitemaps.push(v); continue; }
    if (k === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(v.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (cur && (k === 'allow' || k === 'disallow')) cur.rules.push({ allow: k === 'allow', path: v });
  }
  return { groups, sitemaps };
}

/** Règle la plus spécifique (RFC 9309) ; renvoie true si le chemin est autorisé. */
export function robotsAllows(robots, agent, pathname) {
  const a = agent.toLowerCase();
  let group = robots.groups.filter((g) => g.agents.some((x) => x !== '*' && a.includes(x)));
  if (!group.length) group = robots.groups.filter((g) => g.agents.includes('*'));
  const rules = group.flatMap((g) => g.rules).filter((r) => r.path !== '' || r.allow);
  let best = null;
  for (const r of rules) {
    if (r.path === '') continue;
    const re = new RegExp(`^${r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')}`);
    if (!re.test(pathname)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return best ? best.allow : true;
}

// ───────────────────────── réseau ─────────────────────────

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function fetchOnce(url, { ua = UA_DEFAULT, timeoutMs, method = 'GET' } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, redirect: 'manual', signal: ctl.signal, headers: { 'user-agent': ua, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } });
    const body = method === 'HEAD' ? '' : await res.text();
    return { status: res.status, headers: Object.fromEntries(res.headers), body, location: res.headers.get('location') };
  } finally { clearTimeout(t); }
}

/** Suit les redirections manuellement (détection de boucle, nombre de sauts). Réessaie une fois en cas d'erreur réseau. */
export async function fetchChain(url, opts) {
  const hops = [];
  let cur = url;
  for (let i = 0; i < 10; i++) {
    let r;
    try { r = await fetchOnce(cur, opts); } catch {
      await sleep(1500);
      try { r = await fetchOnce(cur, opts); } catch (e) { return { url, finalUrl: cur, status: 0, error: String(e?.cause?.code ?? e?.name ?? e), hops, headers: {}, body: '' }; }
    }
    if (r.status === 429 || r.status >= 500) {
      // Erreur serveur ou limitation transitoire : une seule nouvelle tentative, bornée.
      await sleep(2000);
      try { r = await fetchOnce(cur, opts); } catch { /* on garde la première réponse */ }
    }
    if (r.status >= 300 && r.status < 400 && r.location) {
      const next = new URL(r.location, cur).href;
      hops.push({ from: cur, status: r.status, to: next });
      if (hops.some((h) => h.from === next)) return { url, finalUrl: next, status: r.status, loop: true, hops, headers: r.headers, body: '' };
      cur = next;
      continue;
    }
    return { url, finalUrl: cur, status: r.status, hops, headers: r.headers, body: r.body };
  }
  return { url, finalUrl: cur, status: 0, loop: true, hops, headers: {}, body: '' };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const normLoc = (l) => { try { return l ? new URL(l).href : l; } catch { return l; } };

export function parseSitemap(xml) {
  const locs = [...xml.matchAll(/<(sitemap|url)\b[\s\S]*?<\/\1>/gi)].map((m) => ({
    kind: m[1].toLowerCase(),
    loc: normLoc(decode(m[0].match(/<loc>\s*([\s\S]*?)\s*<\/loc>/i)?.[1] ?? '')),
    lastmod: m[0].match(/<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/i)?.[1] ?? null,
  })).filter((x) => x.loc);
  return { isIndex: /<sitemapindex\b/i.test(xml), entries: locs };
}

// ───────────────────────── contrôles ─────────────────────────

const SECRET_PATTERNS = [
  [/sk_live_[0-9a-zA-Z]{10,}/, 'clé secrète Stripe'],
  [/\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/, 'clé Resend'],
  [/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, 'clé privée'],
  [/\bghp_[A-Za-z0-9]{30,}/, 'jeton GitHub'],
  [/\bAIza[0-9A-Za-z_-]{35}\b(?=[\s\S]*private_key)/, 'clé Google de compte de service'],
];

function findSecrets(html) {
  const hits = SECRET_PATTERNS.filter(([re]) => re.test(html)).map(([, label]) => label);
  for (const m of html.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
    try {
      const payload = JSON.parse(Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
      if (payload?.role === 'service_role') hits.push('clé Supabase service_role');
    } catch { /* jeton non décodable : ignoré */ }
  }
  return [...new Set(hits)];
}

export class Findings {
  constructor() { this.items = []; }
  add(severity, id, message, url = null) {
    if (!this.items.some((f) => f.id === id && f.url === url && f.message === message)) this.items.push({ severity, id, message, url });
  }
  count(s) { return this.items.filter((f) => f.severity === s).length; }
}

const stripHash = (u) => { const x = new URL(u); x.hash = ''; return x.href; };

/** Contrôles portant sur une page HTML déjà récupérée. */
export function checkPage(cfg, f, url, page, { inSitemap, isPublicRoute, xRobots = '' }) {
  const u = new URL(url);
  const pth = u.pathname;
  const isPrivate = cfg.privatePaths.some((p) => pth.startsWith(p));
  const noindex = /noindex|none/.test(page.robots) || /noindex|none/i.test(xRobots);
  const mustIndex = (inSitemap || isPublicRoute) && !isPrivate;

  if (mustIndex && noindex) f.add('bloquant', 'noindex-public', `Page publique en noindex (${page.robots || xRobots})`, url);
  if (isPrivate && !noindex && (inSitemap || isPublicRoute)) f.add('bloquant', 'private-indexable', 'Chemin privé exposé comme page indexable', url);
  for (const s of findSecrets(page.raw)) f.add('bloquant', 'secret-leak', `Secret potentiel dans le HTML : ${s}`, url);
  if (noindex && !mustIndex) return; // page volontairement non indexable : le reste est éditorial

  if (mustIndex) {
    if (!page.canonical) f.add('majeur', 'canonical-missing', 'Balise canonical absente', url);
    else {
      let can;
      try { can = new URL(page.canonical, url); } catch { can = null; }
      if (!can) f.add('bloquant', 'canonical-invalid', `Canonical invalide : ${page.canonical}`, url);
      else if (can.origin !== cfg.canonicalOrigin) f.add('bloquant', 'canonical-host', `Canonical vers un autre domaine : ${can.href}`, url);
      else if (stripHash(can.href) !== stripHash(new URL(pth + u.search, cfg.canonicalOrigin).href)) {
        f.add(inSitemap ? 'bloquant' : 'majeur', 'canonical-not-self', `Canonical différente de l'URL ${inSitemap ? 'du sitemap' : 'publique'} : ${can.href}`, url);
      }
    }
    if (page.visibleText.length < 250) f.add('bloquant', 'empty-html', `Contenu quasi absent du HTML sans JavaScript (${page.visibleText.length} caractères)`, url);
  }
  if (page.title === null || page.title === '') f.add('majeur', 'title-missing', 'Balise <title> absente ou vide', url);
  else if (page.title.length > 70) f.add('mineur', 'title-long', `Titre long (${page.title.length} caractères)`, url);
  if (!page.description) f.add('mineur', 'description-missing', 'Meta description absente', url);
  else if (page.description.length > 170) f.add('mineur', 'description-long', `Description longue (${page.description.length} caractères)`, url);
  if (page.h1.length === 0) f.add('majeur', 'h1-missing', 'Aucun H1 dans le HTML', url);
  else if (page.h1.length > 1) f.add('mineur', 'h1-multiple', `${page.h1.length} H1`, url);
  if (!page.lang) f.add('mineur', 'lang-missing', 'Attribut lang absent', url);
  if (page.imagesWithoutAlt) f.add('mineur', 'img-alt', `${page.imagesWithoutAlt} image(s) sans attribut alt`, url);
  const internal = page.anchors.filter((a) => { try { return new URL(a.href, url).origin === u.origin; } catch { return false; } });
  if (mustIndex && internal.length === 0) f.add('majeur', 'no-internal-links', 'Aucun lien interne explorable (<a href>)', url);

  // Mentions interdites (ancienne marque, offre retirée, promesse non validée)
  const hay = `${page.title ?? ''} ${page.description ?? ''} ${page.visibleText} ${page.jsonLd.filter((b) => b.ok).map((b) => JSON.stringify(b.data)).join(' ')}`;
  for (const p of cfg.forbiddenPatterns) {
    if (p.paths && !p.paths.some((x) => pth.startsWith(x))) continue;
    const m = hay.match(new RegExp(p.pattern, p.flags ?? 'i'));
    if (m) f.add(p.severity ?? 'bloquant', 'forbidden-text', `Mention interdite « ${m[0]} » (${p.reason})`, url);
  }
  for (const r of cfg.requiredText) {
    if (r.path === pth && !new RegExp(r.pattern, r.flags ?? 'i').test(hay)) f.add(r.severity ?? 'bloquant', 'required-text', `Texte attendu absent : ${r.pattern}${r.reason ? ` (${r.reason})` : ''}`, url);
  }

  // Données structurées
  for (const b of page.jsonLd) if (!b.ok) f.add('majeur', 'jsonld-syntax', `JSON-LD invalide : ${b.error}`, url);
  const nodes = jsonLdNodes(page.jsonLd);
  for (const n of nodes) {
    for (const t of typesOf(n)) if (cfg.structuredData.forbiddenTypes.includes(t)) f.add('bloquant', 'jsonld-forbidden', `Type JSON-LD interdit : ${t}`, url);
    if (cfg.phone && n.telephone && normPhone(n.telephone) !== cfg.phone.e164) f.add('bloquant', 'jsonld-phone', `Téléphone JSON-LD ${n.telephone} ≠ ${cfg.phone.e164}`, url);
    if (n.url && typesOf(n).some((t) => /Organization|LocalBusiness|WebSite|Store|Service|ProfessionalService|HomeAndConstructionBusiness/.test(t))) {
      try { if (new URL(n.url, url).origin !== cfg.canonicalOrigin) f.add('bloquant', 'jsonld-url-host', `URL d'entité hors domaine canonique : ${n.url}`, url); } catch { /* ignorée */ }
    }
    if (n.aggregateRating || n.review) f.add('bloquant', 'jsonld-rating', 'Avis ou note agrégée dans le JSON-LD (interdit sans avis réels affichés et vérifiés)', url);
  }
  if (cfg.phone && nodes.some((n) => n.telephone)) {
    const digits = page.visibleText.replace(/[^\d+]/g, '');
    const local = `0${cfg.phone.e164.slice(3)}`;
    const visibleOk = digits.includes(cfg.phone.e164.replace('+', '')) || digits.includes(local) || (cfg.phone.display ?? []).some((d) => page.visibleText.includes(d)) || page.raw.includes(`tel:${cfg.phone.e164}`);
    if (!visibleOk) f.add('majeur', 'phone-not-visible', 'Téléphone présent en JSON-LD mais pas dans le contenu visible', url);
  }
  const req = cfg.structuredData.requireOn?.[pth];
  if (req) for (const t of req) if (!nodes.some((n) => typesOf(n).includes(t))) f.add('majeur', 'jsonld-missing', `Type JSON-LD attendu absent : ${t}`, url);
  if (/(?:src|href)="http:\/\//i.test(page.raw.replace(/<a\b[^>]*>/gi, ''))) f.add('mineur', 'mixed-content', 'Ressource chargée en http://', url);
}

function trailingSlashOk(cfg, pth) {
  if (cfg.trailingSlash === 'any' || pth === '/' || /\.[a-z0-9]{2,5}$/i.test(pth)) return true;
  return cfg.trailingSlash === 'always' ? pth.endsWith('/') : !pth.endsWith('/');
}

/** Contrôle en ligne (domaine de production ou serveur local via --base). */
export async function runLive(cfg, { base = null, deep = false, log = () => {} } = {}) {
  const f = new Findings();
  const L = cfg.limits;
  const origin = base ? new URL(base).origin : cfg.canonicalOrigin;
  const toFetch = (u) => { const x = new URL(u); return new URL(x.pathname + x.search, origin).href; };
  const isProd = origin === cfg.canonicalOrigin;
  const opts = { timeoutMs: L.timeoutMs };
  const pages = new Map();

  // robots.txt
  const robotsRes = await fetchChain(`${origin}/robots.txt`, opts);
  let robots = { groups: [], sitemaps: [] };
  if (robotsRes.status === 200) robots = parseRobots(robotsRes.body);
  else if (robotsRes.status >= 500 || robotsRes.status === 0) f.add('bloquant', 'robots-unreachable', `robots.txt inaccessible (${robotsRes.status || robotsRes.error}) : Google peut suspendre l'exploration`, `${origin}/robots.txt`);
  if (!robotsAllows(robots, 'Googlebot', '/')) f.add('bloquant', 'robots-blocks-root', 'robots.txt bloque la racine pour Googlebot', `${origin}/robots.txt`);
  if (robotsRes.status === 200 && !robots.sitemaps.length) f.add('mineur', 'robots-no-sitemap', 'robots.txt ne déclare aucun sitemap', `${origin}/robots.txt`);

  // Sitemaps
  const sitemapUrls = new Map();
  const queue = cfg.sitemaps.map((s) => new URL(s, cfg.canonicalOrigin).href);
  const seenMaps = new Set();
  while (queue.length && seenMaps.size < 50) {
    const sm = queue.shift();
    if (seenMaps.has(sm)) continue;
    seenMaps.add(sm);
    const r = await fetchChain(toFetch(sm), opts);
    if (r.status !== 200 || r.hops.length) { f.add('bloquant', 'sitemap-unreachable', `Sitemap ${r.hops.length ? 'redirigé' : 'en erreur'} (${r.status || r.error})`, sm); continue; }
    const parsed = parseSitemap(r.body);
    for (const e of parsed.entries) {
      if (e.kind === 'sitemap') queue.push(e.loc);
      else if (sitemapUrls.has(e.loc)) f.add('mineur', 'sitemap-duplicate', 'URL en double dans le sitemap', e.loc);
      else sitemapUrls.set(e.loc, e.lastmod);
    }
  }
  if (!sitemapUrls.size) f.add('bloquant', 'sitemap-empty', 'Aucune URL dans le(s) sitemap(s)', cfg.sitemaps.join(', '));
  const lastmods = [...sitemapUrls.values()].filter(Boolean);
  if (lastmods.length > 5 && new Set(lastmods.map((d) => d.slice(0, 10))).size === 1 && lastmods[0].slice(0, 10) === new Date().toISOString().slice(0, 10)) {
    f.add('mineur', 'lastmod-build-date', "Toutes les dates lastmod valent aujourd'hui : elles reflètent probablement la date de génération, pas les changements réels");
  }
  for (const loc of sitemapUrls.keys()) {
    let u;
    try { u = new URL(loc); } catch { f.add('bloquant', 'sitemap-bad-url', `URL invalide : ${loc}`); continue; }
    if (u.origin !== cfg.canonicalOrigin) f.add('bloquant', 'sitemap-foreign-host', `URL hors domaine canonique dans le sitemap`, loc);
    if (cfg.privatePaths.some((p) => u.pathname.startsWith(p))) f.add('bloquant', 'sitemap-private', 'Chemin privé listé dans le sitemap', loc);
    if (!trailingSlashOk(cfg, u.pathname)) f.add('majeur', 'sitemap-trailing-slash', `Convention de barre finale (${cfg.trailingSlash}) non respectée`, loc);
    if (/\.pdf($|\?)/i.test(u.pathname)) f.add('majeur', 'sitemap-pdf', 'PDF listé dans le sitemap : vérifier qu\'il est public', loc);
  }

  // Pages : sitemap + routes publiques
  const publicAbs = cfg.publicRoutes.map((p) => new URL(p, cfg.canonicalOrigin).href);
  const targets = [...new Set([...publicAbs, ...sitemapUrls.keys()])];
  if (targets.length > L.maxPages) f.add('mineur', 'crawl-truncated', `${targets.length - L.maxPages} URL non contrôlées (limits.maxPages = ${L.maxPages})`);
  const checked = targets.slice(0, L.maxPages);
  await pool(checked, L.concurrency, async (canon) => {
    const r = await fetchChain(toFetch(canon), opts);
    const inSitemap = sitemapUrls.has(canon);
    const isPublicRoute = publicAbs.includes(canon);
    if (r.loop) { f.add('bloquant', 'redirect-loop', 'Boucle de redirection', canon); return; }
    if (r.status !== 200) {
      f.add(inSitemap || isPublicRoute ? 'bloquant' : 'majeur', 'status', `Statut ${r.status || r.error}${r.hops.length ? ` après ${r.hops.length} redirection(s)` : ''}`, canon);
      return;
    }
    if (r.hops.length) { f.add(inSitemap ? 'bloquant' : 'majeur', 'redirected', `URL ${inSitemap ? 'du sitemap ' : ''}redirigée vers ${r.finalUrl}`, canon); return; }
    if (isPublicRoute && !inSitemap && sitemapUrls.size) f.add('majeur', 'public-not-in-sitemap', 'Route publique absente du sitemap', canon);
    const ct = r.headers['content-type'] ?? '';
    if (!/html/i.test(ct)) return;
    const page = parseHtml(r.body);
    pages.set(canon, page);
    const pthOk = robotsAllows(robots, 'Googlebot', new URL(canon).pathname);
    if (!pthOk && (inSitemap || isPublicRoute)) f.add('bloquant', 'robots-blocks-public', 'Page publique bloquée par robots.txt', canon);
    checkPage(cfg, f, canon, page, { inSitemap, isPublicRoute, xRobots: r.headers['x-robots-tag'] ?? '' });
  });
  log(`${pages.size} page(s) HTML contrôlée(s)`);

  // Vrai 404
  const nf = await fetchChain(`${origin}${cfg.notFoundProbe}`, opts);
  if (nf.status === 200) f.add('majeur', 'soft-404', nf.hops.length ? 'Une URL inexistante est redirigée vers une page 200 au lieu de répondre 404/410' : 'Une URL inexistante répond 200 (soft 404) au lieu de 404/410', `${origin}${cfg.notFoundProbe}`);

  // Chemins privés
  for (const p of cfg.privateProbe) {
    const r = await fetchChain(`${origin}${p}`, opts);
    if (r.status === 200 && /html/i.test(r.headers['content-type'] ?? '')) {
      const page = parseHtml(r.body);
      const noindex = /noindex|none/.test(page.robots) || /noindex|none/i.test(r.headers['x-robots-tag'] ?? '');
      if (!noindex) f.add('bloquant', 'private-indexable', 'Espace privé accessible et indexable (ni noindex, ni authentification)', `${origin}${p}`);
      for (const s of findSecrets(r.body)) f.add('bloquant', 'secret-leak', `Secret potentiel : ${s}`, `${origin}${p}`);
    }
  }

  // Formulaires
  for (const form of cfg.forms) {
    const canon = new URL(form.path, cfg.canonicalOrigin).href;
    let page = pages.get(canon);
    if (!page) { const r = await fetchChain(toFetch(canon), opts); if (r.status === 200) page = parseHtml(r.body); }
    if (!page) f.add('bloquant', 'form-page', 'Page du formulaire inaccessible', canon);
    else if (!page.hasForm && !(form.contains && page.raw.includes(form.contains))) f.add('bloquant', 'form-missing', 'Formulaire absent du HTML', canon);
    else if (form.contains && !page.raw.includes(form.contains)) f.add('bloquant', 'form-marker', `Marqueur du formulaire absent : ${form.contains}`, canon);
  }

  // Liens internes cassés (mode approfondi, hebdomadaire)
  if (deep) {
    const links = new Set();
    for (const [u, page] of pages) for (const a of page.anchors) {
      try {
        const x = new URL(a.href, u);
        if (x.origin === cfg.canonicalOrigin && !cfg.privatePaths.some((p) => x.pathname.startsWith(p))) { x.hash = ''; links.add(x.href); }
      } catch { /* lien invalide ignoré */ }
    }
    const list = [...links].filter((l) => !pages.has(l)).slice(0, L.deepLinkLimit);
    await pool(list, L.concurrency, async (l) => {
      const r = await fetchChain(toFetch(l), opts);
      if (r.loop) f.add('bloquant', 'redirect-loop', 'Boucle de redirection (lien interne)', l);
      else if (r.status >= 400 || r.status === 0) f.add('majeur', 'broken-link', `Lien interne cassé (${r.status || r.error})`, l);
      else if (r.hops.length > 1) f.add('mineur', 'link-chain', `Lien interne avec ${r.hops.length} redirections`, l);
    });
    log(`${list.length} lien(s) interne(s) supplémentaire(s) vérifié(s)`);
  }

  // Domaine : variantes, anciens liens, robots — seulement sur la production
  if (isProd) {
    const variants = [`http://${new URL(cfg.canonicalOrigin).host}/`, ...cfg.alternateHosts.map((h) => new URL('/', h).href)];
    for (const v of variants) {
      const probe = new URL('/__seo-check-path/?x=1', v).href;
      const r = await fetchChain(probe, opts);
      if (r.loop) { f.add('bloquant', 'redirect-loop', 'Boucle de redirection', v); continue; }
      if (!r.hops.length) { f.add('bloquant', 'variant-no-redirect', `Variante non redirigée vers ${cfg.canonicalOrigin} (statut ${r.status || r.error})`, v); continue; }
      const final = new URL(r.finalUrl);
      if (final.origin !== cfg.canonicalOrigin) f.add('bloquant', 'variant-wrong-target', `Variante redirigée vers ${final.origin}`, v);
      else if (!final.pathname.startsWith('/__seo-check-path')) f.add('majeur', 'variant-path-lost', 'Redirection de domaine qui ne conserve pas le chemin', v);
      if (r.hops.some((h) => ![301, 308].includes(h.status))) f.add('majeur', 'variant-temporary', `Redirection non permanente (${r.hops.map((h) => h.status).join(' → ')})`, v);
      if (r.hops.length > L.maxRedirectHops) f.add('mineur', 'variant-chain', `${r.hops.length} redirections successives`, v);
    }
    for (const lr of cfg.legacyRedirects) {
      const r = await fetchChain(lr.from, opts);
      const want = stripHash(new URL(lr.to, cfg.canonicalOrigin).href);
      if (r.loop) f.add('bloquant', 'redirect-loop', 'Boucle de redirection', lr.from);
      else if (stripHash(r.finalUrl) !== want || r.status !== 200) f.add('bloquant', 'legacy-broken', `Ancien lien stratégique : ${r.finalUrl} (${r.status || r.error}) au lieu de ${want}`, lr.from);
      else if (r.hops.some((h) => ![301, 308].includes(h.status)) && !lr.allowTemporary) f.add('majeur', 'legacy-temporary', `Redirection non permanente (${r.hops.map((h) => h.status).join(' → ')})`, lr.from);
    }
    for (const [list, sev] of [[cfg.bots.mustAllow, 'bloquant'], [cfg.bots.shouldAllow, 'majeur']]) {
      for (const bot of list) {
        if (!robotsAllows(robots, bot, '/')) f.add(sev, 'robots-blocks-bot', `robots.txt bloque ${bot}`, `${origin}/robots.txt`);
        const r = await fetchChain(`${origin}/`, { ...opts, ua: BOT_UAS[bot] });
        if ([401, 403, 429, 503].includes(r.status) || r.status === 0) f.add(sev, 'bot-blocked', `${bot} reçoit ${r.status || r.error} sur l'accueil (pare-feu/CDN ?)`, `${origin}/`);
      }
    }
  }
  return { findings: f.items, pagesChecked: pages.size, sitemapUrls: sitemapUrls.size, pageUrls: [...pages.keys()] };
}

/** Contrôle statique d'un dossier de build (CI sans réseau). */
export async function runDist(cfg, dir, { log = () => {} } = {}) {
  const f = new Findings();
  const exists = async (p) => { try { await access(p); return true; } catch { return false; } };
  const fileFor = async (pth) => {
    const clean = decodeURIComponent(pth).replace(/^\/+/, '');
    for (const c of [clean, path.join(clean, 'index.html'), `${clean.replace(/\/$/, '')}.html`]) {
      const p = path.join(dir, c);
      if (await exists(p) && (await stat(p)).isFile()) return p;
    }
    return null;
  };
  let robots = { groups: [], sitemaps: [] };
  const robotsFile = path.join(dir, 'robots.txt');
  if (await exists(robotsFile)) robots = parseRobots(await readFile(robotsFile, 'utf8'));
  if (!robotsAllows(robots, 'Googlebot', '/')) f.add('bloquant', 'robots-blocks-root', 'robots.txt bloque la racine pour Googlebot', 'robots.txt');

  const sitemapUrls = new Map();
  const queue = [...cfg.sitemaps];
  const seen = new Set();
  while (queue.length && seen.size < 50) {
    const s = queue.shift();
    const pth = new URL(s, cfg.canonicalOrigin).pathname;
    if (seen.has(pth)) continue;
    seen.add(pth);
    const file = await fileFor(pth);
    if (!file) { f.add('bloquant', 'sitemap-unreachable', 'Sitemap absent du build', pth); continue; }
    for (const e of parseSitemap(await readFile(file, 'utf8')).entries) {
      if (e.kind === 'sitemap') queue.push(e.loc); else sitemapUrls.set(e.loc, e.lastmod);
    }
  }
  if (!sitemapUrls.size) f.add('bloquant', 'sitemap-empty', 'Aucune URL dans le(s) sitemap(s) du build');
  const publicAbs = cfg.publicRoutes.map((p) => new URL(p, cfg.canonicalOrigin).href);
  let n = 0;
  for (const canon of new Set([...publicAbs, ...sitemapUrls.keys()])) {
    let u;
    try { u = new URL(canon); } catch { f.add('bloquant', 'sitemap-bad-url', `URL invalide : ${canon}`); continue; }
    const inSitemap = sitemapUrls.has(canon);
    if (u.origin !== cfg.canonicalOrigin) { f.add('bloquant', 'sitemap-foreign-host', 'URL hors domaine canonique', canon); continue; }
    if (inSitemap && cfg.privatePaths.some((p) => u.pathname.startsWith(p))) f.add('bloquant', 'sitemap-private', 'Chemin privé listé dans le sitemap', canon);
    if (inSitemap && !trailingSlashOk(cfg, u.pathname)) f.add('majeur', 'sitemap-trailing-slash', `Convention de barre finale (${cfg.trailingSlash}) non respectée`, canon);
    const file = await fileFor(u.pathname);
    if (!file) { if (!cfg.dynamicRoutes?.some((p) => u.pathname.startsWith(p))) f.add('bloquant', 'missing-file', 'Aucun fichier HTML généré pour cette URL', canon); continue; }
    if (!file.endsWith('.html')) continue;
    const page = parseHtml(await readFile(file, 'utf8'));
    n++;
    if (!robotsAllows(robots, 'Googlebot', u.pathname) && inSitemap) f.add('bloquant', 'robots-blocks-public', 'Page du sitemap bloquée par robots.txt', canon);
    checkPage(cfg, f, canon, page, { inSitemap, isPublicRoute: publicAbs.includes(canon) });
  }
  if (cfg.notFoundPage && !(await exists(path.join(dir, cfg.notFoundPage)))) f.add('majeur', 'no-404-page', `Page 404 absente (${cfg.notFoundPage})`);
  log(`${n} page(s) HTML contrôlée(s) dans ${dir}`);
  return { findings: f.items, pagesChecked: n, sitemapUrls: sitemapUrls.size, pageUrls: [] };
}

// ───────────────────────── rapport ─────────────────────────

const ORDER = { bloquant: 0, majeur: 1, mineur: 2 };

export function fingerprint(findings, severities = ['bloquant']) {
  const keys = findings.filter((x) => severities.includes(x.severity)).map((x) => `${x.id}|${x.url ?? ''}`).sort();
  return createHash('sha256').update(keys.join('\n')).digest('hex').slice(0, 16);
}

export function toMarkdown(results) {
  const lines = [];
  for (const r of results) {
    const c = (s) => r.findings.filter((x) => x.severity === s).length;
    lines.push(`## ${r.site} — ${r.mode} — ${r.finishedAt}`, '');
    lines.push(`Origine : ${r.origin} · pages HTML : ${r.pagesChecked} · URL de sitemap : ${r.sitemapUrls} · bloquants : **${c('bloquant')}** · majeurs : ${c('majeur')} · mineurs : ${c('mineur')} · empreinte : \`${r.fingerprint}\``, '');
    const sorted = [...r.findings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.id.localeCompare(b.id));
    if (!sorted.length) lines.push('Aucun écart détecté.', '');
    else {
      lines.push('| Gravité | Contrôle | URL | Constat |', '|---|---|---|---|');
      for (const x of sorted.slice(0, 200)) lines.push(`| ${x.severity} | ${x.id} | ${x.url ?? ''} | ${x.message.replace(/\|/g, '\\|')} |`);
      if (sorted.length > 200) lines.push('', `… ${sorted.length - 200} constat(s) supplémentaire(s) dans le JSON.`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

// ───────────────────────── IndexNow ─────────────────────────

/** Soumet uniquement les URL ajoutées, modifiées ou supprimées depuis la dernière soumission (registre local). */
export async function runIndexNow(cfg, { ledgerFile, key, dryRun = false, log = () => {}, endpoint = 'https://api.indexnow.org/indexnow' }) {
  if (!key) throw new ConfigError('Clé IndexNow absente (variable INDEXNOW_KEY ou cfg.indexnow.key)');
  const keyLocation = cfg.indexnow?.keyLocation ?? `${cfg.canonicalOrigin}/${key}.txt`;
  const kr = await fetchChain(keyLocation, { timeoutMs: cfg.limits.timeoutMs });
  if (kr.status !== 200 || kr.body.trim() !== key) throw new Error(`Fichier de clé IndexNow non publié ou différent à ${keyLocation} (statut ${kr.status})`);
  let ledger = { version: 1, urls: {}, submissions: [] };
  try { ledger = JSON.parse(await readFile(ledgerFile, 'utf8')); } catch { /* premier passage */ }
  const current = new Map();
  for (const s of cfg.sitemaps) {
    const r = await fetchChain(new URL(s, cfg.canonicalOrigin).href, { timeoutMs: cfg.limits.timeoutMs });
    if (r.status !== 200) throw new Error(`Sitemap inaccessible : ${s} (${r.status})`);
    const p = parseSitemap(r.body);
    for (const e of p.entries) {
      if (e.kind === 'sitemap') {
        const r2 = await fetchChain(e.loc, { timeoutMs: cfg.limits.timeoutMs });
        if (r2.status === 200) for (const e2 of parseSitemap(r2.body).entries) if (e2.kind === 'url') current.set(e2.loc, e2.lastmod ?? '');
      } else current.set(e.loc, e.lastmod ?? '');
    }
  }
  const changed = [];
  for (const [u, lm] of current) if (!(u in ledger.urls) || ledger.urls[u] !== lm) changed.push(u);
  const removed = Object.keys(ledger.urls).filter((u) => !current.has(u));
  const urlList = [...new Set([...changed, ...removed])].filter((u) => new URL(u).origin === cfg.canonicalOrigin).slice(0, 10000);
  log(`${changed.length} ajoutée(s)/modifiée(s), ${removed.length} supprimée(s)`);
  const entry = { at: new Date().toISOString(), count: urlList.length, dryRun, status: null };
  if (urlList.length && !dryRun) {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ host: new URL(cfg.canonicalOrigin).host, key, keyLocation, urlList }) });
    entry.status = res.status;
    entry.body = (await res.text()).slice(0, 300);
    if (![200, 202].includes(res.status)) { ledger.submissions = [...(ledger.submissions ?? []), entry].slice(-50); await saveJson(ledgerFile, ledger); throw new Error(`IndexNow a répondu ${res.status}`); }
  }
  if (!dryRun) {
    ledger.urls = Object.fromEntries(current);
    ledger.submissions = [...(ledger.submissions ?? []), entry].slice(-50);
    await saveJson(ledgerFile, ledger);
  }
  return { submitted: dryRun ? 0 : urlList.length, urlList, entry };
}

async function saveJson(file, data) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

// ───────────────────────── init ─────────────────────────

const TEMPLATE_RULE = `# SEO — règles du projet (standard web-seo-local-google-ia)

- Configuration vérifiée : \`seo/site.config.json\` ; preuves : \`docs/seo/preuves.md\` ; intentions : \`docs/seo/intentions.csv\` ; état : \`docs/seo/etat.md\`.
- Avant toute livraison touchant une page publique : \`npm run seo:check\` (aucun « bloquant » toléré).
- Toute affirmation commerciale sensible (certification, délai, zone, prix, réalisation, avis) doit avoir une source datée dans \`docs/seo/preuves.md\`. Sinon, ne pas la publier.
- Aucun faux avis, AggregateRating, établissement, auteur, partenariat ni promesse de classement ou d'indexation.
- Espaces privés : authentification réelle + noindex ; jamais dans le sitemap. robots.txt ne protège rien.
- Données structurées générées depuis les mêmes données que le contenu visible.
`;

export async function runInit({ cwd = process.cwd(), site = 'mon-site', origin = 'https://exemple.fr', log = () => {} } = {}) {
  const created = [];
  const write = async (rel, content) => {
    const p = path.join(cwd, rel);
    try { await access(p); log(`conservé : ${rel}`); return; } catch { /* absent */ }
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, content);
    created.push(rel);
    log(`créé : ${rel}`);
  };
  const cfg = {
    $comment: 'Standard web-seo-local-google-ia — renseigner uniquement des informations vérifiées (source dans docs/seo/preuves.md).',
    version: 1, site, canonicalOrigin: origin, trailingSlash: 'any',
    alternateHosts: [`https://www.${new URL(origin).host.replace(/^www\./, '')}`],
    legacyRedirects: [], sitemaps: ['/sitemap.xml'], publicRoutes: ['/'],
    privatePaths: ['/admin', '/api/'], privateProbe: [], notFoundProbe: '/__seo-check-404__',
    forbiddenPatterns: [], requiredText: [], forms: [],
    structuredData: { forbiddenTypes: ['AggregateRating', 'Review'], requireOn: {} },
    bots: { mustAllow: ['Googlebot', 'Bingbot'], shouldAllow: ['OAI-SearchBot', 'PerplexityBot'] },
    searchConsole: { property: null }, bing: { site: null }, indexnow: { keyLocation: null },
    business: { activity: null, zones: [], localBusinessEligible: null, address: { public: false } },
    publication: { requiresApproval: true, notes: null },
  };
  await write('seo/site.config.json', `${JSON.stringify(cfg, null, 2)}\n`);
  await write('docs/seo/preuves.md', '# Registre des preuves\n\n| Affirmation | Page(s) | Source | Date | Vérifié par |\n|---|---|---|---|---|\n');
  await write('docs/seo/intentions.csv', 'site,intention,variantes,source,date,zone,url_cible,preuve_disponible,action,priorite,statut\n');
  await write('docs/seo/etat.md', `# État SEO — ${site}\n\n| Contrôle | Dernier passage | Réalisé et prouvé | Manque | Accès bloquant | Prochaine action |\n|---|---|---|---|---|---|\n`);
  await write('.claude/rules/seo.md', TEMPLATE_RULE);
  const pkgFile = path.join(cwd, 'package.json');
  try {
    const pkg = JSON.parse(await readFile(pkgFile, 'utf8'));
    pkg.scripts ??= {};
    let changed = false;
    for (const [k, v] of [['seo:check', 'node scripts/seo-check.mjs check'], ['seo:report', 'node scripts/seo-check.mjs report'], ['seo:init', 'node scripts/seo-check.mjs init']]) {
      if (!pkg.scripts[k]) { pkg.scripts[k] = v; changed = true; }
    }
    if (changed) { await writeFile(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`); created.push('package.json (scripts seo:*)'); log('package.json : scripts seo:* ajoutés'); }
  } catch { log('package.json absent : scripts non ajoutés'); }
  return created;
}

// ───────────────────────── CLI ─────────────────────────

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const k = a.slice(2);
    const next = argv[i + 1];
    const val = next === undefined || next.startsWith('--') ? true : (i++, next);
    if (out[k] === undefined) out[k] = val; else out[k] = [].concat(out[k], val);
  }
  return out;
}

async function main() {
  const a = args(process.argv.slice(2));
  const cmd = a._[0] ?? 'check';
  const log = (m) => { if (!a.quiet) process.stderr.write(`seo-check: ${m}\n`); };
  if (cmd === 'version') { console.log(VERSION); return 0; }
  if (cmd === 'init') {
    const created = await runInit({ site: a.site ?? undefined, origin: a.origin ?? undefined, log });
    log(created.length ? `${created.length} élément(s) créé(s)` : 'rien à créer (déjà initialisé)');
    return 0;
  }
  if (cmd === 'report') {
    const ins = [].concat(a.in ?? []);
    const results = [];
    for (const f of ins) results.push(JSON.parse(await readFile(f, 'utf8')));
    const md = toMarkdown(results);
    if (a.md) { await mkdir(path.dirname(a.md), { recursive: true }); await writeFile(a.md, md); } else console.log(md);
    return 0;
  }
  const cfg = await loadConfig(a.config ?? 'seo/site.config.json');
  if (cmd === 'indexnow') {
    const r = await runIndexNow(cfg, { ledgerFile: a.ledger ?? 'seo/state/indexnow.json', key: process.env.INDEXNOW_KEY ?? cfg.indexnow?.key, dryRun: Boolean(a['dry-run']), log });
    console.log(JSON.stringify({ submitted: r.submitted, entry: r.entry }, null, 2));
    return 0;
  }
  if (cmd !== 'check') { console.error(`Commande inconnue : ${cmd}`); return 2; }
  const startedAt = new Date().toISOString();
  const mode = a.dist ? 'dist' : a.base ? 'local' : 'production';
  const res = a.dist ? await runDist(cfg, a.dist, { log }) : await runLive(cfg, { base: a.base ?? null, deep: Boolean(a.deep), log });
  const out = { tool: 'seo-check', version: VERSION, site: cfg.site, mode: `${mode}${a.deep ? '+deep' : ''}`, origin: a.base ?? (a.dist ? `dist:${a.dist}` : cfg.canonicalOrigin), startedAt, finishedAt: new Date().toISOString(), ...res, fingerprint: fingerprint(res.findings) };
  if (a.json) await saveJson(a.json, out);
  if (!a.quiet) console.log(toMarkdown([out]));
  const failOn = a['fail-on'] ?? 'bloquant';
  const failing = out.findings.filter((x) => ORDER[x.severity] <= ORDER[failOn]).length;
  return failing ? 1 : 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  main().then((code) => { process.exitCode = code; }, (e) => {
    console.error(e instanceof ConfigError ? e.message : `seo-check : erreur ${e?.stack ?? e}`);
    process.exitCode = 2;
  });
}
