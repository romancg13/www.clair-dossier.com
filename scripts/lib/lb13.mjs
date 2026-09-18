// Logique LB13 (sans effet de bord) : diagnostic de l'état Stripe réel,
// plan d'actions idempotent, exécution contrôlée. Utilisée par
// scripts/create-lb13-promo.mjs et testée par tests/lb13.test.ts avec un
// client Stripe simulé.
//
// Conditions commerciales validées : −20 % sur les 4 premières mensualités
// de toute formule MENSUELLE, code « LB13 » à saisir avant le 21 septembre
// 2026 — borne exclusive 21/09/2026 00:00 Europe/Paris (CEST, UTC+2)
// = 2026-09-20T22:00:00Z. Hors formules annuelles et sur-mesure. Aucun
// plafond global, aucun minimum, aucune restriction « première commande ».

export const LB13 = Object.freeze({
  code: 'LB13',
  percentOff: 20,
  durationInMonths: 4,
  deadlineIso: '2026-09-21T00:00:00+02:00',
  deadlineTs: 1789941600,
  couponId: 'LB13-20PCT-4M',
  couponName: 'LB13 −20 % pendant 4 mois',
  campagne: 'LB13',
});

// Payment Links publiés sur /tarifs (src/data/pricing.ts : ctaHref / ctaHrefYearly).
export const MONTHLY_LINKS = Object.freeze([
  'https://buy.stripe.com/00w9AT9Qm7fJ4vbeSibV605', // Essentiel 19 €
  'https://buy.stripe.com/8x214n1jQ2Zt9Pvh0qbV606', // Entrepreneur 39 €
  'https://buy.stripe.com/5kQaEX7IeeIb4vb11sbV607', // Business PME 20 — 49 €
  'https://buy.stripe.com/28E4gz8Mi9nRaTz25wbV608', // Business PME 50 — 89 €
  'https://buy.stripe.com/5kQbJ1e6C7fJ6DjdOebV609', // Business / PME Pro — 169 €
  'https://buy.stripe.com/9B628raUq8jNgdT8tUbV60a', // Business / PME Premium — 299 €
]);
export const YEARLY_LINKS = Object.freeze([
  'https://buy.stripe.com/dRm9ATbYu6bF9PvfWmbV60b',
  'https://buy.stripe.com/28EeVd9QmgQj7HndOebV60c',
  'https://buy.stripe.com/14AbJ18MicA3e5L11sbV60d',
  'https://buy.stripe.com/6oU00j5A69nR3r7bG6bV60e',
  'https://buy.stripe.com/cNifZh9Qm8jNe5L39AbV60f',
  'https://buy.stripe.com/28EeVdaUq7fJd1H11sbV60g',
]);

/** Identifiant du coupon rattaché, quelle que soit la version d'API. */
export function couponIdOf(promotionCode) {
  const c = promotionCode?.promotion?.coupon ?? promotionCode?.coupon ?? null;
  if (!c) return null;
  return typeof c === 'string' ? c : c.id ?? null;
}

export function isLb13Coupon(c) {
  return (
    c?.metadata?.campagne === LB13.campagne ||
    String(c?.id ?? '').toUpperCase().startsWith('LB13') ||
    /lb13/i.test(String(c?.name ?? ''))
  );
}

const idOf = (x) => (x && typeof x === 'object' ? x.id : x) ?? null;
const fmt = (ts) => (ts == null ? 'aucune' : new Date(ts * 1000).toISOString());

/** Écarts d'un coupon par rapport aux conditions validées ([] = conforme). */
export function couponProblems(c, targetProducts, now) {
  const p = [];
  if (c.amount_off != null) p.push(`remise en montant (${c.amount_off}) au lieu d'un pourcentage`);
  if (c.percent_off !== LB13.percentOff) p.push(`percent_off=${c.percent_off} (attendu ${LB13.percentOff})`);
  if (c.duration !== 'repeating') p.push(`duration=${c.duration} (attendu repeating)`);
  if (c.duration_in_months !== LB13.durationInMonths)
    p.push(`duration_in_months=${c.duration_in_months} (attendu ${LB13.durationInMonths})`);
  if (c.valid === false) p.push('coupon invalide (valid=false : expiré ou épuisé)');
  if (c.max_redemptions != null) p.push(`plafond global max_redemptions=${c.max_redemptions} (absent des conditions)`);
  if (c.redeem_by != null && c.redeem_by < LB13.deadlineTs)
    p.push(`redeem_by=${fmt(c.redeem_by)} coupe l'offre avant l'échéance`);
  if (c.redeem_by != null && c.redeem_by <= now) p.push('redeem_by déjà dépassé');
  const products = c.applies_to?.products;
  if (Array.isArray(products) && products.length > 0) {
    const missing = targetProducts.filter((id) => !products.includes(id));
    if (missing.length) p.push(`applies_to exclut des formules mensuelles : ${missing.join(', ')}`);
  }
  return p;
}

/** Écarts d'un code promo LB13 ([] = conforme). */
export function promotionCodeProblems(pc, goodCouponIds) {
  const p = [];
  if (String(pc.code).toUpperCase() !== LB13.code) p.push(`code=${pc.code}`);
  if (!pc.active) p.push('inactif');
  const cid = couponIdOf(pc);
  if (!goodCouponIds.includes(cid)) p.push(`rattaché au coupon ${cid ?? 'inconnu'} non conforme`);
  if (pc.expires_at == null) p.push("aucune échéance (l'offre serait prolongée)");
  else if (pc.expires_at > LB13.deadlineTs) p.push(`échéance ${fmt(pc.expires_at)} après le 21/09 00:00 Paris (offre prolongée)`);
  else if (pc.expires_at < LB13.deadlineTs) p.push(`échéance ${fmt(pc.expires_at)} avant le 21/09 00:00 Paris`);
  if (pc.max_redemptions != null) p.push(`plafond max_redemptions=${pc.max_redemptions} (absent des conditions)`);
  if (idOf(pc.customer)) p.push('réservé à un seul client');
  const r = pc.restrictions ?? {};
  if (r.first_time_transaction) p.push('restriction « première commande » (absente des conditions)');
  if (r.minimum_amount != null) p.push(`montant minimum ${r.minimum_amount} (absent des conditions)`);
  return p;
}

/**
 * Diagnostic + plan d'actions à partir d'un état Stripe collecté.
 * state = { mode, now, coupons, promotionCodes, otherActiveCodes,
 *           monthly: [{ url, link, items }], yearly: [...], portals }
 */
export function planLb13(state) {
  const { now } = state;
  const diag = [];
  const actions = [];
  const ok = (m) => diag.push({ level: 'ok', m });
  const warn = (m) => diag.push({ level: 'warn', m });
  const err = (m) => diag.push({ level: 'error', m });
  const ended = now >= LB13.deadlineTs;

  // 1) Liens de paiement réellement publiés et cadence des prix.
  const targetProducts = new Set();
  for (const l of state.monthly) {
    if (!l.link) { err(`Lien mensuel introuvable dans ce compte/mode : ${l.url}`); continue; }
    if (!l.link.active) warn(`Lien mensuel inactif : ${l.url}`);
    for (const it of l.items) {
      const interval = it.price?.recurring?.interval;
      if (interval !== 'month') err(`${l.url} vend un prix ${interval ?? 'ponctuel'} (attendu mensuel)`);
      const prod = idOf(it.price?.product);
      if (prod) targetProducts.add(prod);
    }
  }
  const yearlyProducts = new Set();
  for (const l of state.yearly) {
    if (!l.link) { warn(`Lien annuel introuvable dans ce compte/mode : ${l.url}`); continue; }
    for (const it of l.items) {
      if (it.price?.recurring?.interval !== 'year') warn(`${l.url} ne vend pas un prix annuel`);
      const prod = idOf(it.price?.product);
      if (prod) yearlyProducts.add(prod);
    }
  }
  const shared = [...yearlyProducts].filter((p) => targetProducts.has(p));
  if (shared.length) {
    warn(`${shared.length} produit(s) vendus en mensuel ET en annuel : une restriction par produit ne suffit pas — les codes promo doivent être désactivés sur les liens annuels.`);
  }
  const products = [...targetProducts];

  // 2) Coupons candidats.
  const lb13Coupons = state.coupons.filter(isLb13Coupon);
  const good = [];
  for (const c of lb13Coupons) {
    const probs = couponProblems(c, products, now);
    if (probs.length) warn(`Coupon ${c.id} non conforme : ${probs.join(' ; ')}`);
    else { good.push(c.id); ok(`Coupon ${c.id} conforme (−${c.percent_off} %, ${c.duration_in_months} mois, redeem_by ${fmt(c.redeem_by)}).`); }
  }
  if (!lb13Coupons.length) warn('Aucun coupon LB13 dans ce compte/mode.');

  // 3) Codes promo « LB13 » (recherche insensible à la casse).
  const codes = state.promotionCodes.filter((pc) => String(pc.code).toUpperCase() === LB13.code);
  const activeCodes = codes.filter((pc) => pc.active);
  const conforming = activeCodes.filter((pc) => promotionCodeProblems(pc, good).length === 0);
  for (const pc of activeCodes) {
    const probs = promotionCodeProblems(pc, good);
    if (probs.length) err(`Code promo actif ${pc.id} (${pc.code}) non conforme : ${probs.join(' ; ')}`);
    else ok(`Code promo ${pc.id} « ${pc.code} » actif, coupon ${couponIdOf(pc)}, échéance ${fmt(pc.expires_at)}.`);
  }
  for (const pc of codes.filter((c) => !c.active)) warn(`Ancien code ${pc.id} inactif (conservé, jamais réactivé).`);
  if (!codes.length) err('Aucun code promo « LB13 » saisissable dans ce compte/mode : cause directe du refus au Checkout.');

  // 4) Portail client : chemins de souscription secondaires.
  const yearlyPrices = new Set(state.yearly.flatMap((l) => l.items.map((it) => idOf(it.price))));
  for (const cfg of state.portals ?? []) {
    const su = cfg.features?.subscription_update;
    if (!su?.enabled) { ok(`Portail ${cfg.id} : changement d'offre désactivé.`); continue; }
    if ((su.default_allowed_updates ?? []).includes('promotion_code'))
      warn(`Portail ${cfg.id} : saisie de codes promo autorisée lors d'un changement d'offre — à désactiver (Dashboard → Portail client → Codes promotionnels).`);
    const toYearly = (su.products ?? []).some((p) => (p.prices ?? []).some((pr) => yearlyPrices.has(pr)));
    if (toYearly)
      warn(`Portail ${cfg.id} : passage mensuel → annuel possible ; une remise LB13 en cours s'appliquerait à la facture annuelle — retirer les prix annuels du changement d'offre.`);
  }

  if (ended) {
    warn(`Échéance dépassée (${LB13.deadlineIso}) : aucune création ni activation — l'offre n'est jamais prolongée sans validation. Les remises déjà acquises continuent jusqu'à leur 4e mois.`);
    return { diag, actions, products, ended };
  }

  // 5) Actions idempotentes (ordre significatif).
  let couponRef = good.find((id) => activeCodes.some((pc) => couponIdOf(pc) === id)) ?? good[0] ?? null;
  if (!conforming.length) {
    if (!couponRef) {
      const taken = state.coupons.some((c) => c.id === LB13.couponId);
      couponRef = taken ? `${LB13.couponId}-V2` : LB13.couponId;
      actions.push({
        type: 'create_coupon',
        params: {
          id: couponRef,
          name: LB13.couponName,
          percent_off: LB13.percentOff,
          duration: 'repeating',
          duration_in_months: LB13.durationInMonths,
          redeem_by: LB13.deadlineTs,
          ...(products.length ? { applies_to: { products } } : {}),
          metadata: { campagne: LB13.campagne, echeance: LB13.deadlineIso, offre: 'formules mensuelles' },
        },
      });
    }
    for (const pc of activeCodes) actions.push({ type: 'deactivate_promotion_code', id: pc.id });
    actions.push({
      type: 'create_promotion_code',
      params: {
        promotion: { type: 'coupon', coupon: couponRef },
        code: LB13.code,
        active: true,
        expires_at: LB13.deadlineTs,
        metadata: { campagne: LB13.campagne },
      },
    });
  } else {
    for (const pc of activeCodes.filter((c) => !conforming.includes(c)))
      actions.push({ type: 'deactivate_promotion_code', id: pc.id });
  }
  for (const l of state.monthly) {
    if (l.link && !l.link.allow_promotion_codes) actions.push({ type: 'enable_link_promotions', id: l.link.id, url: l.url });
  }
  for (const l of state.yearly) {
    if (l.link && l.link.allow_promotion_codes) actions.push({ type: 'disable_link_promotions', id: l.link.id, url: l.url });
  }
  const others = (state.otherActiveCodes ?? []).filter((pc) => String(pc.code).toUpperCase() !== LB13.code);
  if (others.length && actions.some((a) => a.type === 'disable_link_promotions')) {
    warn(`Désactiver les codes sur les liens annuels concerne aussi ${others.length} autre(s) code(s) actif(s) : ${others.map((c) => c.code).join(', ')}.`);
  }
  return { diag, actions, products, ended };
}

async function listAll(listFn, params = {}) {
  const out = [];
  let page = await listFn({ limit: 100, ...params });
  out.push(...page.data);
  while (page.has_more && page.data.length) {
    page = await listFn({ limit: 100, ...params, starting_after: page.data[page.data.length - 1].id });
    out.push(...page.data);
  }
  return out;
}

/** Lecture seule de l'état Stripe utile à LB13. */
export async function collectLb13State(stripe, { now, mode }) {
  const links = await listAll((p) => stripe.paymentLinks.list(p));
  const byUrl = new Map(links.map((l) => [l.url, l]));
  const withItems = async (url) => {
    const link = byUrl.get(url) ?? null;
    const items = link ? await listAll((p) => stripe.paymentLinks.listLineItems(link.id, p)) : [];
    return { url, link, items };
  };
  const monthly = [];
  for (const u of MONTHLY_LINKS) monthly.push(await withItems(u));
  const yearly = [];
  for (const u of YEARLY_LINKS) yearly.push(await withItems(u));
  const coupons = await listAll((p) => stripe.coupons.list({ ...p, expand: ['data.applies_to'] }));
  const promotionCodes = await listAll((p) => stripe.promotionCodes.list({ ...p, code: LB13.code }));
  const otherActiveCodes = await listAll((p) => stripe.promotionCodes.list({ ...p, active: true }));
  let portals = [];
  try {
    portals = await listAll((p) => stripe.billingPortal.configurations.list({ ...p, active: true }));
  } catch {
    portals = null;
  }
  return { mode, now, coupons, promotionCodes, otherActiveCodes, monthly, yearly, portals: portals ?? [], portalsReadable: portals !== null };
}

/** Exécute un plan : jamais de suppression, clés d'idempotence stables. */
export async function applyLb13(stripe, plan, log = () => {}) {
  let createdCoupon = null;
  const done = [];
  for (const a of plan.actions) {
    const key = `lb13-${LB13.deadlineTs}-${a.type}-${a.id ?? a.params?.id ?? a.params?.code ?? ''}`;
    if (a.type === 'create_coupon') {
      createdCoupon = await stripe.coupons.create(a.params, { idempotencyKey: key });
      done.push(`coupon créé ${createdCoupon.id}`);
    } else if (a.type === 'deactivate_promotion_code') {
      await stripe.promotionCodes.update(a.id, { active: false });
      done.push(`code ${a.id} désactivé (remises déjà acquises conservées)`);
    } else if (a.type === 'create_promotion_code') {
      const pc = await stripe.promotionCodes.create(a.params, { idempotencyKey: key });
      done.push(`code promo créé ${pc.id} (${pc.code})`);
    } else if (a.type === 'enable_link_promotions') {
      await stripe.paymentLinks.update(a.id, { allow_promotion_codes: true });
      done.push(`codes promo autorisés sur ${a.url}`);
    } else if (a.type === 'disable_link_promotions') {
      await stripe.paymentLinks.update(a.id, { allow_promotion_codes: false });
      done.push(`codes promo retirés du lien annuel ${a.url}`);
    }
    log(done[done.length - 1]);
  }
  return { done, createdCoupon };
}

/** Montants attendus (centimes) des n premières factures d'un prix mensuel. */
export function expectedInvoiceAmounts(unitAmountCents, count = LB13.durationInMonths + 1) {
  return Array.from({ length: count }, (_, i) =>
    i < LB13.durationInMonths ? Math.round(unitAmountCents * (1 - LB13.percentOff / 100)) : unitAmountCents,
  );
}
