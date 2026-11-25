#!/usr/bin/env node
/**
 * Calculateur PRIVÉ de rentabilité (outil interne, rien de commercial n'est modifié).
 *
 *   node scripts/rentabilite.mjs            → tableau dans le terminal
 *   node scripts/rentabilite.mjs --md       → Markdown (docs/recette/RENTABILITE.md)
 *   node scripts/rentabilite.mjs --json     → données brutes
 *   USD_EUR=0.95 node scripts/rentabilite.mjs   → autre taux de change
 *
 * CE QUI EST MESURÉ / OFFICIEL : les prix des offres (src/data/pricing.ts : nets, TVA non
 * applicable — franchise en base) et les tarifs API (table officielle, 2026-11-03).
 * CE QUI EST UNE HYPOTHÈSE (aucun usage client réel n'a été mesuré) : tout le bloc HYPOTHESES.
 * Remplacez-les par les chiffres du registre des coûts dès que la recette tourne avec une clé.
 */

// ── Officiel ────────────────────────────────────────────────────────────────
const API_USD_PER_MTOK = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-fable-5-2': { input: 8, output: 40 },
};
const OFFRES = [
  { id: 'essentiel', nom: 'Essentiel', prix: 19, dossiers: 5 },
  { id: 'entrepreneur', nom: 'Entrepreneur', prix: 39, dossiers: 10 },
  { id: 'business-pme-20', nom: 'Business PME 20', prix: 49, dossiers: 20 },
  { id: 'business-pme-50', nom: 'Business PME 50', prix: 89, dossiers: 50 },
  { id: 'business-pme-pro', nom: 'Pro', prix: 169, dossiers: 100 }, // illimité : 100 dossiers actifs retenus par prudence
  { id: 'business-pme-premium', nom: 'Premium', prix: 299, dossiers: 200 }, // illimité : 200 retenus par prudence
];
const REMISE_ANNUELLE = 0.1;
const OPTIONS = [
  { nom: 'Automation Pro', prix: 19, budgetApi: 3 },
  { nom: 'Vigilance Pro', prix: 29, budgetApi: 5 },
  { nom: 'Pilotage Pro', prix: 39, budgetApi: 7 },
];

// ── Hypothèses (à remplacer par les mesures) ────────────────────────────────
const HYPOTHESES = {
  usdEur: Number(process.env.USD_EUR) || 0.92,
  // Jetons par opération.
  extraction: { modele: 'claude-sonnet-5-5', input: 6000, output: 900 }, // une pièce de ~3 pages
  consolidation: { modele: 'claude-sonnet-5-5', input: 12000, output: 2500 }, // une révision de dossier
  message: { appels: 1.4, input: 2500, output: 350, mix: { 'claude-haiku-5-5': 0.5, 'claude-sonnet-5-5': 0.35, 'claude-opus-5-5': 0.15 } },
  partRegles: 0.4, // part des pièces lues par les règles seules (texte natif simple) : 0 € d'API
  // Usage mensuel par DOSSIER ACTIF, et part des dossiers du plafond réellement actifs.
  scenarios: {
    faible: { actifs: 0.2, pieces: 3, revisions: 1, messages: 1 },
    normal: { actifs: 0.4, pieces: 10, revisions: 2, messages: 4 },
    intensif: { actifs: 0.8, pieces: 40, revisions: 4, messages: 15 },
  },
  stockage: { moParPiece: 1.5, moisCumules: 12, eurParGoMois: 0.025 },
  stripe: { taux: 0.015, fixe: 0.25 }, // cartes européennes standard — à vérifier sur votre compte
  hebergementVariable: 0.5, // € par client et par mois
  support: 1.0, // € par client et par mois directement attribuable
  margeCible: 0.7,
  creditsMensuelsUsd: 200,
};

const H = HYPOTHESES;
const eur = (usd) => usd * H.usdEur;
const coutAppel = (modele, input, output) => eur((input * API_USD_PER_MTOK[modele].input + output * API_USD_PER_MTOK[modele].output) / 1e6);
const C = {
  piece: coutAppel(H.extraction.modele, H.extraction.input, H.extraction.output) * (1 - H.partRegles),
  revision: coutAppel(H.consolidation.modele, H.consolidation.input, H.consolidation.output),
  message: H.message.appels * Object.entries(H.message.mix).reduce((s, [m, part]) => s + part * coutAppel(m, H.message.input, H.message.output), 0),
};
const r2 = (n) => Math.round(n * 100) / 100;

function couts(offre, sc, prix) {
  const actifs = offre.dossiers * sc.actifs;
  const api = actifs * (sc.pieces * C.piece + sc.revisions * C.revision + sc.messages * C.message);
  const stockage = ((actifs * sc.pieces * H.stockage.moisCumules * H.stockage.moParPiece) / 1024) * H.stockage.eurParGoMois;
  const stripe = prix * H.stripe.taux + H.stripe.fixe;
  const total = api + stockage + stripe + H.hebergementVariable + H.support;
  return { api, stockage, stripe, total, marge: (prix - total) / prix, prixMin: total / (1 - H.margeCible) };
}

const lignes = [];
for (const o of OFFRES)
  for (const [nom, sc] of Object.entries(H.scenarios)) {
    const m = couts(o, sc, o.prix);
    const a = couts(o, sc, o.prix * (1 - REMISE_ANNUELLE));
    // Budget API mensuel compatible avec la marge cible (quota soutenable).
    const fixes = m.stockage + m.stripe + H.hebergementVariable + H.support;
    const budgetApi = Math.max(0, o.prix * (1 - H.margeCible) - fixes);
    lignes.push({ offre: o.nom, prix: o.prix, scenario: nom, api: r2(m.api), couts: r2(m.total), marge: Math.round(m.marge * 100), margeAnnuel: Math.round(a.marge * 100), prixMin: r2(m.prixMin), budgetApi: r2(budgetApi), ok: m.marge >= H.margeCible });
  }
const options = OPTIONS.map((o) => {
  const total = o.budgetApi + o.prix * H.stripe.taux; // frais fixes Stripe déjà portés par l'abonnement
  return { option: o.nom, prix: o.prix, budgetApi: o.budgetApi, marge: Math.round(((o.prix - total) / o.prix) * 100), budgetApiMax: r2(o.prix * (1 - H.margeCible) - o.prix * H.stripe.taux) };
});
// Crédits inclus : combien de clients « normaux » ils couvrent (avantage temporaire de trésorerie).
const apiNormal = OFFRES.map((o) => ({ offre: o.nom, api: couts(o, H.scenarios.normal, o.prix).api }));
const credits = apiNormal.map((x) => ({ offre: x.offre, clientsCouverts: Math.floor(eur(H.creditsMensuelsUsd) / Math.max(x.api, 0.01)) }));

const data = { hypotheses: H, coutsUnitaires: { piece: r2(C.piece * 100) / 100, revision: C.revision, message: C.message }, lignes, options, credits };
if (process.argv.includes('--json')) console.log(JSON.stringify(data, null, 2));
else if (process.argv.includes('--md')) {
  const c3 = (n) => n.toFixed(4).replace('.', ',');
  const e = (n) => `${n.toFixed(2).replace('.', ',')} €`;
  const out = [];
  out.push('# Rentabilité — calculateur privé', '', `Généré par \`node scripts/rentabilite.mjs --md\`. Taux retenu : 1 USD = ${H.usdEur} EUR (hypothèse à actualiser).`, '');
  out.push('**Officiel** : prix des offres (nets, TVA non applicable) et tarifs API. **Hypothèses** : tous les volumes d’usage, la taille des appels, Stripe, hébergement et support — aucun usage client réel n’a encore été mesuré. Les remplacer par le registre des coûts (`/api/admin/ia`) dès que la recette tourne avec une clé.', '');
  out.push('## Coûts unitaires estimés', '', '| Opération | Coût API estimé |', '|---|---|', `| Lecture d’une pièce (≈ 3 pages, ${Math.round(H.partRegles * 100)} % lues par les règles seules) | ${c3(C.piece)} € |`, `| Révision d’un dossier (synthèse + six rendus) | ${c3(C.revision)} € |`, `| Message à l’assistant (${H.message.appels} appel en moyenne, modèle choisi selon la demande) | ${c3(C.message)} € |`, '| Téléchargement, ZIP, automatisation « bilan », rappel d’échéance | 0 € (aucun appel IA) |', '');
  out.push('## Marge par offre et par scénario', '', `Marge = (prix net − coûts directs) / prix net. Cible : ${H.margeCible * 100} %.`, '', '| Offre | Prix | Scénario | Coût API | Coûts directs | Marge mensuel | Marge annuel (−10 %) | Budget API soutenable |', '|---|---|---|---|---|---|---|---|');
  for (const l of lignes) out.push(`| ${l.offre} | ${l.prix} € | ${l.scenario} | ${e(l.api)} | ${e(l.couts)} | ${l.ok ? '' : '⚠ '}${l.marge} % | ${l.margeAnnuel} % | ${e(l.budgetApi)} |`);
  out.push('', '« Budget API soutenable » = dépense d’API mensuelle maximale par client pour tenir la marge cible : c’est le plafond à appliquer côté serveur (quota), pas un prix à facturer.', '');
  const rouges = lignes.filter((l) => !l.ok);
  out.push('## Lecture', '');
  if (rouges.length) out.push(`- Sous la cible : ${rouges.map((l) => `${l.offre} (${l.scenario}, ${l.marge} %, prix minimal ${e(l.prixMin)})`).join(' ; ')}.`, '- Réponse recommandée : ne pas augmenter les prix, mais plafonner l’API par client au « budget soutenable » ; au-delà, lecture par les règles et résultat annoncé partiel (déjà en place).');
  else out.push('- Toutes les offres tiennent la marge cible dans les trois scénarios, sous ces hypothèses.');
  out.push('', '## Options', '', '| Option | Prix | Budget API indicatif | Marge | Budget API maximal pour 70 % |', '|---|---|---|---|---|');
  for (const o of options) out.push(`| ${o.option} | ${o.prix} € | ${o.budgetApi} € | ${o.marge} % | ${e(o.budgetApiMax)} |`);
  out.push('', 'Les trois options tiennent la cible aux budgets indicatifs. Tarifs provisoires, non commercialisés.', '');
  out.push('## Crédits API inclus (200 USD par mois)', '', `Avantage temporaire de trésorerie, non nécessaire au modèle : toutes les marges ci-dessus sont calculées SANS crédits. Avec eux, l’API est couverte pour environ : ${credits.map((c) => `${c.clientsCouverts} clients ${c.offre}`).join(', ')} (usage normal).`, '');
  out.push('## À mesurer avant toute décision tarifaire', '', '1. Jetons réels par pièce, par révision et par message (registre des coûts).', '2. Part réelle des pièces lisibles par les règles seules.', '3. Frais Stripe constatés et taux de change du jour.', '4. Usage réel par offre après un mois de recette.', '');
  console.log(out.join('\n'));
} else {
  console.table(lignes);
  console.table(options);
}
