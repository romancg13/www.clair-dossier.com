/**
 * Économie de l'IA (console du fondateur) — module PUR, sans réseau.
 *
 * Entrées MESURÉES uniquement : coût IA du mois par compte (`admin_supervision_overview`, somme des
 * `cost_cents` réellement facturés par le fournisseur) et montant de l'abonnement (`subscriptions`, copie de
 * Stripe). Rien n'est inventé : un compte sans montant synchronisé n'a pas de marge (null), compté à part.
 *
 * Calculs :
 *  - revenu mensuel : `monthlyCents` (même définition que l'onglet Revenus) ;
 *  - frais Stripe : ESTIMATION (1,5 % + 0,25 € par encaissement, cartes de l'EEE), affichée comme telle ;
 *  - marge directe IA = (revenu − frais estimés − coût IA) ÷ revenu ;
 *  - prévision de fin de mois = coût constaté × jours du mois ÷ jours écoulés (projection linéaire,
 *    non publiée avant le 3e jour : trop instable) ;
 *  - anomalies : marge projetée sous le seuil (70 % par défaut), coût projeté supérieur au revenu,
 *    coût du mois ≥ 4 × la médiane des comptes payants (et ≥ 1 €), coût sans abonnement actif.
 * Aucune action automatique n'est déclenchée ici : la console propose ; le fondateur décide (pause
 * globale existante, quotas existants par offre).
 */
import { monthlyCents, type RevenueRow } from "./revenue";

export type CompteCout = { user_id: string; offre: string | null; statut_abonnement: string | null; cout_ia_mois_cents: number; dossiers: number; documents: number };

export type AnomalieCode = "MARGE_SOUS_SEUIL" | "COUT_SUPERIEUR_REVENU" | "CONSOMMATION_ATYPIQUE" | "COUT_SANS_ABONNEMENT";

export type LigneEconomie = {
  user_id: string;
  offre: string | null;
  revenu_mensuel_cents: number | null;
  frais_stripe_estimes_cents: number | null;
  cout_ia_cents: number;
  cout_ia_projete_cents: number | null;
  marge_pct: number | null;
  marge_projetee_pct: number | null;
  anomalies: AnomalieCode[];
};

export type Recommandation = { priorite: "haute" | "moyenne" | "info"; texte: string };

export type SyntheseEconomie = {
  mois: string;
  jours_ecoules: number;
  jours_du_mois: number;
  projection_publiee: boolean;
  revenu_mensuel_cents: number;
  cout_ia_cents: number;
  cout_ia_projete_cents: number | null;
  frais_stripe_estimes_cents: number;
  marge_pct: number | null;
  marge_projetee_pct: number | null;
  comptes_sans_montant: number;
  seuil_marge_pct: number;
  lignes: LigneEconomie[];
  recommandations: Recommandation[];
};

const PAYANT = new Set(["active", "past_due", "trialing"]);
/** Frais Stripe : ESTIMATION publique (cartes de l'EEE), jamais présentée comme constatée. */
export const fraisStripeEstimes = (revenuCents: number) => (revenuCents > 0 ? Math.round(revenuCents * 0.015 + 25) : 0);

const pct = (num: number, den: number) => (den > 0 ? Math.round((1000 * num) / den) / 10 : null);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function syntheseEconomie(comptes: CompteCout[], abonnements: RevenueRow[], now: Date = new Date(), seuilMargePct = 70): SyntheseEconomie {
  const debut = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const joursMois = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  const joursEcoules = Math.max(1, Math.min(joursMois, (now.getTime() - debut.getTime()) / 86_400_000));
  const publiee = joursEcoules >= 2;
  const projeter = (c: number) => (publiee ? Math.round((c * joursMois) / joursEcoules) : null);

  // Revenu par compte : abonnements payants de la devise du tableau (EUR), le plus récent par compte.
  const revenu = new Map<string, number | null>();
  for (const r of [...abonnements].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (!r.user_id || !PAYANT.has(r.status) || r.status === "trialing") continue;
    const m = (r.currency ?? "eur") === "eur" ? monthlyCents(r) : null;
    revenu.set(r.user_id, m);
  }

  const payants = comptes.filter((c) => revenu.has(c.user_id)).map((c) => c.cout_ia_mois_cents);
  const med = median(payants);
  const lignes: LigneEconomie[] = comptes.map((c) => {
    const rev = revenu.has(c.user_id) ? revenu.get(c.user_id)! : null;
    const frais = rev === null ? null : fraisStripeEstimes(rev);
    const proj = projeter(c.cout_ia_mois_cents);
    const marge = rev ? pct(rev - (frais ?? 0) - c.cout_ia_mois_cents, rev) : null;
    const margeProj = rev && proj !== null ? pct(rev - (frais ?? 0) - proj, rev) : null;
    const anomalies: AnomalieCode[] = [];
    if (margeProj !== null && margeProj < seuilMargePct) anomalies.push("MARGE_SOUS_SEUIL");
    if (rev && proj !== null && proj > rev) anomalies.push("COUT_SUPERIEUR_REVENU");
    if (payants.length >= 3 && c.cout_ia_mois_cents >= 100 && c.cout_ia_mois_cents >= 4 * med) anomalies.push("CONSOMMATION_ATYPIQUE");
    if (!revenu.has(c.user_id) && c.cout_ia_mois_cents > 0) anomalies.push("COUT_SANS_ABONNEMENT");
    return { user_id: c.user_id, offre: c.offre, revenu_mensuel_cents: rev, frais_stripe_estimes_cents: frais, cout_ia_cents: c.cout_ia_mois_cents, cout_ia_projete_cents: proj, marge_pct: marge, marge_projetee_pct: margeProj, anomalies };
  });

  const avecMontant = lignes.filter((l) => l.revenu_mensuel_cents !== null);
  const rev = avecMontant.reduce((s, l) => s + (l.revenu_mensuel_cents ?? 0), 0);
  const frais = avecMontant.reduce((s, l) => s + (l.frais_stripe_estimes_cents ?? 0), 0);
  const cout = lignes.reduce((s, l) => s + l.cout_ia_cents, 0);
  const coutProj = publiee ? lignes.reduce((s, l) => s + (l.cout_ia_projete_cents ?? 0), 0) : null;
  const synthese: SyntheseEconomie = {
    mois: debut.toISOString().slice(0, 7),
    jours_ecoules: Math.floor(joursEcoules),
    jours_du_mois: joursMois,
    projection_publiee: publiee,
    revenu_mensuel_cents: rev,
    cout_ia_cents: cout,
    cout_ia_projete_cents: coutProj,
    frais_stripe_estimes_cents: frais,
    marge_pct: rev ? pct(rev - frais - cout, rev) : null,
    marge_projetee_pct: rev && coutProj !== null ? pct(rev - frais - coutProj, rev) : null,
    comptes_sans_montant: [...revenu.values()].filter((v) => v === null).length,
    seuil_marge_pct: seuilMargePct,
    lignes: lignes.sort((a, b) => b.anomalies.length - a.anomalies.length || b.cout_ia_cents - a.cout_ia_cents),
    recommandations: [],
  };
  synthese.recommandations = recommandations(synthese);
  return synthese;
}

/** Recommandations déterministes, tirées des seuls chiffres ci-dessus ; jamais appliquées automatiquement. */
export function recommandations(s: SyntheseEconomie): Recommandation[] {
  const out: Recommandation[] = [];
  const n = (code: AnomalieCode) => s.lignes.filter((l) => l.anomalies.includes(code)).length;
  if (s.marge_projetee_pct !== null && s.marge_projetee_pct < s.seuil_marge_pct)
    out.push({ priorite: "haute", texte: `Marge directe projetée ${s.marge_projetee_pct} % sous l'objectif de ${s.seuil_marge_pct} % : réserver le modèle le plus puissant aux analyses avancées, et vérifier les quotas des offres concernées.` });
  if (n("COUT_SUPERIEUR_REVENU")) out.push({ priorite: "haute", texte: `${n("COUT_SUPERIEUR_REVENU")} compte(s) coûtent plus en IA que leur abonnement sur le mois projeté : vérifier leurs dossiers (doublons, très gros lots) avant toute mesure ; le quota de pages de l'offre reste la protection automatique.` });
  if (n("CONSOMMATION_ATYPIQUE")) out.push({ priorite: "moyenne", texte: `${n("CONSOMMATION_ATYPIQUE")} compte(s) consomment au moins 4 fois la médiane : contrôler l'usage avant d'ajuster une offre.` });
  if (n("COUT_SANS_ABONNEMENT")) out.push({ priorite: "moyenne", texte: `${n("COUT_SANS_ABONNEMENT")} compte(s) ont un coût IA sans abonnement payant (essai, dérogation, administration) : vérifier que c'est voulu.` });
  if (n("MARGE_SOUS_SEUIL") && !out.length) out.push({ priorite: "moyenne", texte: `${n("MARGE_SOUS_SEUIL")} compte(s) ont une marge projetée sous ${s.seuil_marge_pct} % : surveiller.` });
  if (s.comptes_sans_montant) out.push({ priorite: "info", texte: `${s.comptes_sans_montant} abonnement(s) sans montant synchronisé : leur marge n'est pas calculée (aucune estimation).` });
  if (!s.projection_publiee) out.push({ priorite: "info", texte: "Projection du mois publiée à partir du 3e jour : trop peu de jours écoulés pour extrapoler." });
  if (!out.length) out.push({ priorite: "info", texte: `Aucune anomalie : marge directe ${s.marge_projetee_pct ?? s.marge_pct ?? "—"} % pour un objectif de ${s.seuil_marge_pct} %.` });
  return out;
}

export const LIBELLE_ANOMALIE: Record<AnomalieCode, string> = {
  MARGE_SOUS_SEUIL: "Marge sous l'objectif",
  COUT_SUPERIEUR_REVENU: "Coût > abonnement",
  CONSOMMATION_ATYPIQUE: "Consommation atypique",
  COUT_SANS_ABONNEMENT: "Coût sans abonnement",
};
