/**
 * Chaîne de livraison d'une sortie d'agent (PARTIE 4.3) : SENTINEL a déjà rendu son
 * verdict (boucle 4.4) ; ECHO rend le sien ici, dernier avant persistance. Le
 * verdict est tracé (exécution ECHO + colonnes sur l'exécution contrôlée) et la
 * livraison est journalisée avec identifiants et compteurs seulement (PARTIE 11).
 */
import type { Store } from "../pipeline/types.ts";
import type { SortieUniverselle } from "../schema/validateur.ts";
import { appliquerVerdictEcho, controlerEcho, VERSION_ECHO, type VerdictEcho } from "./echo.ts";
import type { FournisseurModele } from "./modele.ts";

export const FINALITE_ANALYSE = "analyse_ia";

export type Livraison = {
  sortie: SortieUniverselle;
  verdict: VerdictEcho;
  assertions_retirees: string[];
  /** Faux si ECHO a tout bloqué : rien ne doit être persisté. */
  livrable: boolean;
  echo_run_id: string;
};

export async function passerParEcho(
  store: Store,
  params: {
    sortie: SortieUniverselle;
    run_id: string;
    tenant_id: string;
    dossier_id: string;
    trace_id: string;
    debut: number;
    modele?: FournisseurModele | null;
    nomModele?: string;
    finalite?: string;
  },
): Promise<Livraison> {
  const finalite = params.finalite ?? FINALITE_ANALYSE;
  const conformite = await store.lireContexteConformite(params.dossier_id, finalite);
  const verdict = await controlerEcho(params.sortie, {
    dossier_id: params.dossier_id,
    tenant_id: params.tenant_id,
    finalite: conformite.finalite,
    consentement_effectif: conformite.consentement_effectif,
    typology: conformite.typology,
    modele: params.modele ?? null,
    nomModele: params.nomModele,
  });
  const { sortie, assertions_retirees } = appliquerVerdictEcho(params.sortie, verdict);
  const echoRunId = await store.demarrerRun("ECHO", params.tenant_id, params.dossier_id, params.trace_id,
    `${params.run_id}:echo`, verdict.cout.modele, VERSION_ECHO);
  await store.terminerRun(echoRunId, verdict.bloquer_tout ? "escalade" : "ok", {
    agent_controle: params.sortie.agent, run_controle: params.run_id, finalite, verdict: verdict.verdict, bloquer_tout: verdict.bloquer_tout,
    blocages: verdict.blocages, minimisations: verdict.minimisations.length, categories_sensibles: verdict.categories_sensibles, controle_modele: verdict.controle_modele,
  }, null, Date.now() - params.debut, null, verdict.cout.tokens_entree, verdict.cout.tokens_sortie);
  await store.enregistrerControleEcho(params.run_id, echoRunId, verdict.verdict);
  // Traçabilité de la livraison : identifiants et compteurs seulement, jamais de contenu.
  await store.journaliser(verdict.bloquer_tout ? "sortie.bloquee" : "sortie.livree", "agent_run", params.run_id, params.tenant_id, params.dossier_id, {
    agent: params.sortie.agent, finalite, statut: sortie.statut, nb_assertions: sortie.assertions.length,
    nb_retirees_echo: assertions_retirees.length, nb_masques: verdict.minimisations.length,
    escalades: sortie.escalades.map((e) => e.code), echo: verdict.verdict,
  }, params.trace_id);
  return { sortie, verdict, assertions_retirees, livrable: !verdict.bloquer_tout, echo_run_id: echoRunId };
}
