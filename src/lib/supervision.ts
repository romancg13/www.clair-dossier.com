// Centre de supervision fondateur — logique PURE (aucune dépendance
// Supabase/React), testée sous Node (tests/supervision.test.ts). Types et
// libellés de la lecture agrégée `admin_supervision_overview`
// (migration 20261125140000) : états et compteurs uniquement, aucun contenu.

export type SupervisionAlertCode =
  | "MOTEUR_EN_PAUSE"
  | "QUOTA_ATTEINT"
  | "QUOTA_80"
  | "BUDGET_GLOBAL_ATTEINT"
  | "BUDGET_GLOBAL_80"
  | "PAUSES_BUDGET"
  | "FILE_BLOQUEE"
  | "ECHECS_REPETES"
  | "EMAILS_EN_ERREUR";

export type SupervisionAlert = {
  code: SupervisionAlertCode | string;
  niveau: "info" | "attention" | "critique" | string;
  valeur: number;
};

export type SupervisionAccount = {
  user_id: string;
  offre: string | null;
  statut_abonnement: string | null;
  cout_ia_mois_cents: number;
  pages_utilisees: number | null;
  pages_limite: number | null;
  actions_utilisees: number | null;
  actions_limite: number | null;
  quota_pct: number | null;
  octets: number;
  documents: number;
  dossiers: number;
};

export type SupervisionOverview = {
  version: number;
  genere_le: string;
  moteur: { installe: boolean; en_pause: boolean; en_pause_depuis: string | null };
  file: {
    par_statut: Record<"queued" | "running" | "done" | "failed" | "cancelled", number>;
    ouverts_par_type: Record<string, number>;
    bloques: number;
    reprises_en_cours: number;
    termines_24h: number;
    echecs_24h: number;
    echecs_definitifs_7j: number;
    dossiers_multi_echecs_7j: number;
    pauses_budget_mois: number;
    erreurs_30j: { budget_ou_quota: number; interruption: number; autre: number };
    plus_ancien_en_attente: string | null;
    derniere_activite: string | null;
  } | null;
  traitements_mois: {
    extractions_ok: number;
    extractions_non_prises_en_charge: number;
    extractions_en_erreur: number;
    pages_lues: number;
    analyses: number;
  } | null;
  emails_entrants: {
    recus_30j: number;
    stockes_30j: number;
    rejetes_30j: number;
    en_erreur_30j: number;
    en_erreur_7j: number;
    adresses_actives: number;
  } | null;
  abonnements: {
    par_statut: Record<string, number>;
    en_cours_par_offre: Record<string, number>;
    resiliations_programmees: number;
    derogations_actives: number | null;
  };
  budget: { cout_global_mois_cents: number; repere_alerte_cents: number | null; repere_pct: number | null };
  stockage: { octets: number; documents: number; documents_sans_taille: number; octets_corbeille: number };
  comptes_total: number;
  comptes: SupervisionAccount[];
  alertes: SupervisionAlert[];
  actions_admin:
    | { visible: false }
    | {
        visible: true;
        total_30j: number;
        par_action_30j: Record<string, number>;
        dernieres: { at: string; action: string; ressource: string; acteur: string; compte: string | null }[];
      };
};

const NIVEAUX = ["critique", "attention", "info"];

/** Alertes triées de la plus grave à la moins grave (ordre stable). */
export function sortAlerts(alertes: SupervisionAlert[]): SupervisionAlert[] {
  const rang = (a: SupervisionAlert) => {
    const i = NIVEAUX.indexOf(a.niveau);
    return i === -1 ? NIVEAUX.length : i;
  };
  return alertes.map((a, i) => ({ a, i })).sort((x, y) => rang(x.a) - rang(y.a) || x.i - y.i).map((x) => x.a);
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Phrase lisible d'une alerte ; un code inconnu reste affiché tel quel (jamais masqué). */
export function alertLabel(a: SupervisionAlert): string {
  const n = Number(a.valeur) || 0;
  switch (a.code) {
    case "MOTEUR_EN_PAUSE":
      return "Traitements en pause : aucun travail n'est réclamé tant que la reprise n'est pas demandée.";
    case "QUOTA_ATTEINT":
      return `${pluriel(n, "compte a", "comptes ont")} atteint le plafond mensuel de son offre : nouveaux traitements suspendus.`;
    case "QUOTA_80":
      return `${pluriel(n, "compte dépasse", "comptes dépassent")} 80 % du plafond mensuel de son offre.`;
    case "BUDGET_GLOBAL_ATTEINT":
      return `Budget global : repère d'alerte atteint (${n.toLocaleString("fr-FR")} %).`;
    case "BUDGET_GLOBAL_80":
      return `Budget global : ${n.toLocaleString("fr-FR")} % du repère d'alerte.`;
    case "PAUSES_BUDGET":
      return `${pluriel(n, "travail suspendu", "travaux suspendus")} ce mois pour budget ou quota atteint.`;
    case "FILE_BLOQUEE":
      return `File bloquée : ${pluriel(n, "travail en attente", "travaux en attente")} depuis plus d'une heure ou bail expiré.`;
    case "ECHECS_REPETES":
      return `${pluriel(n, "travail a épuisé", "travaux ont épuisé")} toutes ses tentatives sur 7 jours.`;
    case "EMAILS_EN_ERREUR":
      return `${pluriel(n, "e-mail entrant en erreur", "e-mails entrants en erreur")} sur 7 jours.`;
    default:
      return `${a.code} : ${n.toLocaleString("fr-FR")}`;
  }
}

/** Volume lisible (base 1024, unités françaises). */
export function formatBytes(octets: number | string | null | undefined): string {
  const n = Number(octets ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0 o";
  const unites = ["o", "Ko", "Mo", "Go", "To"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), unites.length - 1);
  const v = n / 1024 ** i;
  return `${v.toLocaleString("fr-FR", { maximumFractionDigits: i === 0 || v >= 100 ? 0 : 1 })} ${unites[i]}`;
}

/** « 45 / 50 » ; plafond absent = non plafonné à ce niveau ; quota illisible = tiret. */
export function quotaLabel(utilise: number | null, limite: number | null): string {
  if (utilise === null && limite === null) return "—";
  return `${utilise ?? 0} / ${limite === null ? "non plafonné" : limite}`;
}

export function quotaTone(pct: number | null): "normal" | "attention" | "critique" {
  if (pct === null) return "normal";
  return pct >= 100 ? "critique" : pct >= 80 ? "attention" : "normal";
}

/** Vérifie la forme minimale de la réponse avant affichage (RPC d'une autre version, réponse vide…). */
export function isSupervisionOverview(v: unknown): v is SupervisionOverview {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return o.version === 1 && Array.isArray(o.comptes) && Array.isArray(o.alertes) && typeof o.moteur === "object" && o.moteur !== null;
}

/** Saisie « 150 » ou « 150,50 » (euros) → centimes entiers ; vide = retrait du repère ; invalide = undefined. */
export function parseEurosToCents(saisie: string): number | null | undefined {
  const t = saisie.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return undefined;
  const cents = Math.round(Number(t) * 100);
  return cents > 0 && cents <= 2_000_000_000 ? cents : undefined;
}
