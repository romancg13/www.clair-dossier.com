/**
 * LDI — appel du relais de jurisprudence.
 *
 * ┌─ CE QUE CE MODULE PEUT ENVOYER ─────────────────────────────────────────┐
 * │ Des références du corpus, et uniquement elles. La fonction n'accepte     │
 * │ pas de chaîne arbitraire : son paramètre est typé sur les références     │
 * │ connues, et le serveur revérifie de son côté.                            │
 * │                                                                          │
 * │ Ce n'est pas de la redondance. Le contrôle client empêche l'erreur ; le  │
 * │ contrôle serveur empêche la falsification. Ils ne protègent pas de la    │
 * │ même chose.                                                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import { CORPUS } from './corpus/references';
import type { DecisionRelayee } from './piste';

/** Références recherchables : celles du corpus, rien d'autre. */
export const REFERENCES_RECHERCHABLES: readonly string[] = CORPUS.map((e) => e.reference);

/**
 * Nombre maximal de références par appel, côté client.
 *
 * Cette constante DOUBLE `REFERENCES_MAX` de `piste.ts` au lieu de l'importer,
 * et c'est délibéré : `piste.ts` est le module qui porte les jetons et les
 * appels sortants vers PISTE. Il est destiné au serveur, et l'importer ici le
 * ferait entrer dans le bundle du navigateur — c'est-à-dire créer le chemin
 * par lequel, un jour, quelqu'un y brancherait des identifiants côté client.
 *
 * La duplication est verrouillée par un test : les deux valeurs ne peuvent pas
 * diverger en silence.
 */
export const REFERENCES_MAX_CLIENT = 8;

export type ResultatReference = {
  reference: string;
  decisions: DecisionRelayee[];
  interrogee: boolean;
  avertissement: string;
};

export type ReponseRecherche =
  | {
      ok: true;
      resultats: ResultatReference[];
      /** Références refusées par le serveur, avec leur libellé d'origine. */
      ecartees: string[];
      origine: string;
      consulteLe: string;
      reserve: string;
    }
  | { ok: false; message: string; configuree: boolean };

type Invocateur = (
  nom: string,
  options: { body: unknown }
) => Promise<{ data: unknown; error: { message?: string; context?: { status?: number } } | null }>;

/**
 * Interroge le relais pour un ensemble de références.
 *
 * `invoquer` est injecté pour que ce module soit testable sans réseau ni
 * client Supabase — le même choix que partout ailleurs dans le noyau.
 */
export async function chercherDecisions(
  references: string[],
  invoquer: Invocateur
): Promise<ReponseRecherche> {
  const connues = new Set(REFERENCES_RECHERCHABLES.map((r) => r.toLowerCase()));
  const recevables = references.filter((r) => connues.has(r.trim().toLowerCase()));

  if (recevables.length === 0) {
    return {
      ok: false,
      configuree: true,
      message:
        "Aucune référence du corpus n'a été sélectionnée. La recherche ne porte que sur les articles connus de l'outil — il n'existe pas de recherche en texte libre.",
    };
  }

  const { data, error } = await invoquer('ldi-jurisprudence', {
    body: { references: recevables },
  });

  if (error) {
    // 503 = relais non configuré. C'est un fait à dire tel quel, pas une
    // panne : l'écran ne doit pas laisser croire qu'il n'y a pas de
    // jurisprudence alors qu'on n'a simplement pas pu chercher.
    const nonConfiguree = error.context?.status === 503;
    return {
      ok: false,
      configuree: !nonConfiguree,
      message: nonConfiguree
        ? "La source officielle n'est pas configurée sur ce déploiement : aucune recherche n'a été faite. L'absence de résultat ne signifie pas l'absence de jurisprudence."
        : (error.message ?? 'Le relais de jurisprudence a répondu par une erreur.'),
    };
  }

  return lireReponse(data);
}

/**
 * Lecture défensive de la réponse du relais.
 *
 * Une entrée qui n'a pas la forme attendue est ignorée, jamais complétée : le
 * module ne doit pas pouvoir produire une décision que le serveur n'a pas
 * renvoyée, quelle que soit la façon dont la réponse est abîmée.
 */
export function lireReponse(data: unknown): ReponseRecherche {
  if (typeof data !== 'object' || data === null) {
    return { ok: false, configuree: true, message: 'Réponse du relais illisible.' };
  }

  const brut = data as Record<string, unknown>;
  const resultats = Array.isArray(brut.resultats) ? brut.resultats : [];

  return {
    ok: true,
    resultats: resultats.map(versResultat).filter((r): r is ResultatReference => r !== null),
    ecartees: Array.isArray(brut.ecartees)
      ? brut.ecartees.filter((x): x is string => typeof x === 'string')
      : [],
    origine: typeof brut.origine === 'string' ? brut.origine : 'origine non précisée',
    consulteLe: typeof brut.consulteLe === 'string' ? brut.consulteLe : '',
    reserve: typeof brut.reserve === 'string' ? brut.reserve : '',
  };
}

function versResultat(brut: unknown): ResultatReference | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const r = brut as Record<string, unknown>;
  if (typeof r.reference !== 'string') return null;

  return {
    reference: r.reference,
    decisions: Array.isArray(r.decisions)
      ? r.decisions.map(versDecision).filter((d): d is DecisionRelayee => d !== null)
      : [],
    interrogee: r.interrogee === true,
    avertissement: typeof r.avertissement === 'string' ? r.avertissement : '',
  };
}

function versDecision(brut: unknown): DecisionRelayee | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const d = brut as Record<string, unknown>;

  // Numéro et date sont indispensables. Une décision sans eux n'est pas
  // citable, et l'afficher inviterait à la citer quand même.
  if (typeof d.numero !== 'string' || typeof d.date !== 'string') return null;
  if (!d.numero.trim() || !d.date.trim()) return null;

  return {
    numero: d.numero,
    date: d.date,
    juridiction: typeof d.juridiction === 'string' ? d.juridiction : '',
    chambre: typeof d.chambre === 'string' ? d.chambre : '',
    sommaire: typeof d.sommaire === 'string' ? d.sommaire : '',
    url: typeof d.url === 'string' ? d.url : null,
  };
}
