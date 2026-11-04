import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { summarizeClicks } from '../src/lib/campaign';

// Exécute le script de src/shortlink/v.html dans un faux navigateur.
const html = readFileSync(new URL('../src/shortlink/v.html', import.meta.url), 'utf-8');
const template = html.match(/<script>([\s\S]*?)<\/script>/)![1];
const script = template
  .replace('__SUPABASE_URL__', 'https://exemple.supabase.co')
  .replace('__SUPABASE_ANON_KEY__', 'cle-anon')
  .replace('__PLAUSIBLE_DOMAIN__', 'clair-dossier.com');

async function visit({ search = '', ua = 'Mozilla/5.0 (iPhone) Safari/604.1', fetchFails = false, fetchHangs = false, code = script } = {}) {
  const calls: { url: string; body: string }[] = [];
  const redirects: string[] = [];
  const timers: (() => void)[] = [];
  runInNewContext(code, {
    URL,
    URLSearchParams,
    JSON,
    Promise,
    location: { search, href: `https://www.clair-dossier.com/v${search}`, replace: (u: string) => redirects.push(u) },
    navigator: { userAgent: ua, webdriver: false },
    document: { prerendering: false, referrer: 'https://www.village-justice.com/' },
    setTimeout: (fn: () => void) => timers.push(fn),
    fetch: (url: string, init: { body: string }) => {
      calls.push({ url, body: init.body });
      if (fetchHangs) return new Promise(() => {});
      return fetchFails ? Promise.reject(new Error('réseau')) : Promise.resolve({});
    },
  });
  await new Promise((r) => setImmediate(r));
  timers.forEach((fn) => fn());
  return { calls, redirects };
}

const DEST = 'https://www.clair-dossier.com/?utm_source=village-justice&utm_medium=publiredactionnel&utm_campaign=2026';

test('un humain : un clic compté + un événement Plausible, puis une seule redirection UTM', async () => {
  const { calls, redirects } = await visit();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://exemple.supabase.co/rest/v1/rpc/record_campaign_click');
  assert.deepEqual(JSON.parse(calls[0].body), { p_source: 'village-justice' });
  assert.equal(calls[1].url, 'https://plausible.io/api/event');
  assert.deepEqual(JSON.parse(calls[1].body), {
    name: 'VillageJusticeClick',
    url: 'https://www.clair-dossier.com/v',
    domain: 'clair-dossier.com',
    referrer: 'https://www.village-justice.com/',
  });
  assert.deepEqual(redirects, [DEST]);
});

test('sans configuration : redirection immédiate, aucun appel', async () => {
  const { calls, redirects } = await visit({ code: template.replace(/__[A-Z_]+__/g, '') });
  assert.equal(calls.length, 0);
  assert.deepEqual(redirects, [DEST]);
});

test('UTM reçus conservés sans écraser la campagne', async () => {
  const { redirects } = await visit({ search: '?utm_content=article&utm_source=autre&x=1' });
  assert.deepEqual(redirects, [`${DEST}&utm_content=article`]);
});

test('robots et prévisualisations : redirigés, jamais comptés', async () => {
  for (const ua of ['Googlebot/2.1', 'LinkedInBot/1.0', 'facebookexternalhit/1.1', 'Slackbot-LinkExpanding 1.0', 'WhatsApp/2.23', 'TelegramBot (like TwitterBot)', 'curl/8.4', 'HeadlessChrome/120']) {
    const { calls, redirects } = await visit({ ua });
    assert.equal(calls.length, 0, ua);
    assert.deepEqual(redirects, [DEST], ua);
  }
});

test('navigateurs intégrés humains comptés (LinkedIn, Facebook, téléphone CUBOT)', async () => {
  for (const ua of ['Mozilla/5.0 (iPhone) Mobile/15E148 [LinkedInApp]', 'Mozilla/5.0 (Linux; Android 13) [FBAN/FB4A;FBAV/400]', 'Mozilla/5.0 (Linux; Android 10; CUBOT X30 Build/QP1A) Chrome/120']) {
    assert.equal((await visit({ ua })).calls.length, 2, ua);
  }
});

test('le comptage en échec ou bloqué ne bloque jamais la redirection', async () => {
  assert.deepEqual((await visit({ fetchFails: true })).redirects, [DEST]);
  assert.deepEqual((await visit({ fetchHangs: true })).redirects, [DEST]);
});

test('agrégation : total, 7 jours, 30 jours avec jours vides', () => {
  const s = summarizeClicks(
    [
      { day: '2026-11-03', clicks: 4 },
      { day: '2026-10-28', clicks: 2 },
      { day: '2026-09-01', clicks: 10 },
    ],
    '2026-11-03',
  );
  assert.equal(s.total, 16);
  assert.equal(s.last7, 6);
  assert.equal(s.days.length, 30);
  assert.deepEqual(s.days[0], { day: '2026-11-03', clicks: 4 });
  assert.deepEqual(s.days[1], { day: '2026-11-02', clicks: 0 });
});
