import { test } from "node:test";
import assert from "node:assert/strict";
import { fraisStripeEstimes, syntheseEconomie, type CompteCout } from "../src/lib/economie-ia.ts";
import type { RevenueRow } from "../src/lib/revenue.ts";

const sub = (user_id: string, unit_amount: number | null, status = "active", currency = "eur"): RevenueRow => ({ user_id, status, plan_id: "essentiel", unit_amount, currency, billing_interval: unit_amount === null ? null : "month", interval_count: 1, quantity: 1, cancel_at_period_end: false, canceled_at: null, created_at: "2026-10-01T00:00:00Z" });
const compte = (user_id: string, cout: number): CompteCout => ({ user_id, offre: "essentiel", statut_abonnement: "active", cout_ia_mois_cents: cout, dossiers: 1, documents: 3 });
const MI_MOIS = new Date("2026-11-16T00:00:00Z"); // 15 jours écoulés sur 30

test("marge, frais Stripe estimés et projection linéaire du mois", () => {
  const s = syntheseEconomie([compte("a", 100)], [sub("a", 1900)], MI_MOIS);
  const l = s.lignes[0];
  assert.equal(l.revenu_mensuel_cents, 1900);
  assert.equal(l.frais_stripe_estimes_cents, fraisStripeEstimes(1900));
  assert.equal(fraisStripeEstimes(1900), 54);
  assert.equal(l.cout_ia_projete_cents, 200);
  assert.equal(l.marge_pct, 91.9); // (1900 − 54 − 100) / 1900
  assert.equal(l.marge_projetee_pct, 86.6); // (1900 − 54 − 200) / 1900
  assert.deepEqual(l.anomalies, []);
  assert.equal(s.marge_projetee_pct, 86.6);
  assert.equal(s.recommandations[0].priorite, "info");
});

test("anomalies : marge sous le seuil, coût supérieur au revenu, consommation atypique, coût sans abonnement", () => {
  const comptes = [compte("a", 50), compte("b", 60), compte("c", 40), compte("gros", 1200), compte("essai", 30)];
  const subs = [sub("a", 1900), sub("b", 1900), sub("c", 1900), sub("gros", 1900)];
  const s = syntheseEconomie(comptes, subs, MI_MOIS);
  const gros = s.lignes.find((l) => l.user_id === "gros")!;
  assert.deepEqual(gros.anomalies, ["MARGE_SOUS_SEUIL", "COUT_SUPERIEUR_REVENU", "CONSOMMATION_ATYPIQUE"]);
  assert.deepEqual(s.lignes.find((l) => l.user_id === "essai")!.anomalies, ["COUT_SANS_ABONNEMENT"]);
  assert.equal(s.lignes[0].user_id, "gros", "les comptes à anomalies d'abord");
  assert.equal(s.recommandations[0].priorite, "haute");
  assert.ok(s.recommandations.some((r) => /1 compte\(s\) coûtent plus en IA que leur abonnement/.test(r.texte)));
});

test("aucune donnée inventée : abonnement sans montant ou en devise étrangère → pas de marge", () => {
  const s = syntheseEconomie([compte("a", 100), compte("b", 100)], [sub("a", null), sub("b", 1900, "active", "usd")], MI_MOIS);
  assert.ok(s.lignes.every((l) => l.marge_pct === null && l.revenu_mensuel_cents === null));
  assert.equal(s.marge_pct, null);
  assert.equal(s.comptes_sans_montant, 2);
  assert.ok(s.recommandations.some((r) => /sans montant synchronisé/.test(r.texte)));
});

test("début de mois : pas de projection publiée", () => {
  const s = syntheseEconomie([compte("a", 100)], [sub("a", 1900)], new Date("2026-11-01T20:00:00Z"));
  assert.equal(s.projection_publiee, false);
  assert.equal(s.cout_ia_projete_cents, null);
  assert.equal(s.lignes[0].marge_projetee_pct, null);
  assert.ok(s.recommandations.some((r) => /3e jour/.test(r.texte)));
});
