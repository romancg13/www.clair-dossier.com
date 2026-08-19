/**
 * DEFENSE OS — moteurs d'inférence (§6.2, décisions D-2 et D-3).
 *
 * ┌─ TROIS MODES, UNE HIÉRARCHIE ───────────────────────────────────────────┐
 * │ « Déterministe seul » : aucun modèle. Toujours disponible — l'outil ne   │
 * │ devient jamais inerte parce qu'aucun modèle n'est installé.              │
 * │                                                                          │
 * │ « Local » (DÉFAUT quand un modèle existe) : un serveur de modèle SUR LE  │
 * │ POSTE, piloté par la CLI. Ce module REFUSE à la construction toute URL   │
 * │ qui ne pointe pas vers la machine locale : un moteur « local » qui       │
 * │ parlerait à un hôte distant serait un mensonge d'étiquette, le pire.     │
 * │                                                                          │
 * │ « Distant » : CONSTRUIT, DÉSACTIVÉ, non atteignable depuis l'interface.  │
 * │ Deux verrous cumulatifs : la variable d'environnement ET un consentement │
 * │ par dossier, horodaté. L'un sans l'autre ne suffit pas.                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Ce fichier n'est importable que par la CLI et les tests : un test de
 * frontière échoue si l'interface l'importe (B7/B8 — l'atelier n'émet rien).
 */
import type { Moteur } from './passes';

export type ReponseMoteur =
  | { ok: true; texte: string }
  | { ok: false; erreur: string };

export type MoteurInference = {
  descriptif: Moteur;
  generer(instruction: string, contexte: string): Promise<ReponseMoteur>;
};

/** Hôtes admis pour un moteur « local ». Rien d'autre ne l'est. */
const HOTES_LOCAUX = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export type ConfigMoteurLocal = {
  /** Point d'accès du serveur de modèle, ex. http://127.0.0.1:11434 */
  url: string;
  modele: string;
  fetchImpl?: typeof fetch;
  delaiMs?: number;
};

/**
 * Moteur local — dialecte Ollama (`POST /api/generate`, stream désactivé).
 *
 * Lève À LA CONSTRUCTION si l'URL n'est pas locale : l'erreur doit précéder
 * tout usage, pas survenir au premier envoi de contenu de dossier.
 */
export function creerMoteurLocal(config: ConfigMoteurLocal): MoteurInference {
  const url = new URL(config.url);
  if (!HOTES_LOCAUX.has(url.hostname)) {
    throw new Error(
      `Moteur « local » refusé : ${url.hostname} n'est pas la machine locale. ` +
        "Un moteur local qui parle à un hôte distant est un mensonge d'étiquette — utiliser le mode distant, avec ses verrous."
    );
  }

  const appel = config.fetchImpl ?? fetch;

  return {
    descriptif: { type: 'local', modele: config.modele, consentementDistant: false },

    async generer(instruction, contexte) {
      const controleur = new AbortController();
      const minuterie = setTimeout(() => controleur.abort(), config.delaiMs ?? 120_000);
      try {
        const reponse = await appel(new URL('/api/generate', url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.modele,
            system: instruction,
            prompt: contexte,
            stream: false,
          }),
          signal: controleur.signal,
        });

        if (!reponse.ok) {
          return { ok: false, erreur: `Le serveur de modèle local a répondu ${reponse.status}. Vérifier qu'un modèle « ${config.modele} » est installé (voir README, « moteur d'inférence »).` };
        }
        const charge = (await reponse.json()) as { response?: unknown };
        if (typeof charge.response !== 'string' || charge.response.trim() === '') {
          return { ok: false, erreur: 'Réponse du modèle local vide ou illisible.' };
        }
        return { ok: true, texte: charge.response };
      } catch {
        return {
          ok: false,
          erreur:
            `Aucun serveur de modèle local joignable sur ${config.url}. ` +
            "Le mode déterministe reste pleinement disponible ; pour l'inférence, installer un serveur local (voir README).",
        };
      } finally {
        clearTimeout(minuterie);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Mode distant — construit, désactivé (D-3)
// ---------------------------------------------------------------------------

export type ConsentementDistant = {
  dossierReference: string;
  horodatage: string;
};

export type ConfigMoteurDistant = {
  /** Doit valoir exactement 'oui' — lu de LDI_DISTANT_ACTIVE, jamais d'un écran. */
  active: string | undefined;
  cleApi: string | undefined;
  modele: string;
  /** Consentement PAR DOSSIER, horodaté, fourni à l'appel — pas stocké ici. */
  consentement: ConsentementDistant | null;
  fetchImpl?: typeof fetch;
  delaiMs?: number;
};

export const REFUS_DISTANT_INACTIF =
  "Mode distant désactivé (décision D-3). Il ne s'active que par LDI_DISTANT_ACTIVE=oui dans l'environnement de la CLI ET un consentement par dossier — jamais depuis l'interface.";

export const REFUS_SANS_CONSENTEMENT =
  'Mode distant : consentement de dossier absent. Fournir --consentement-dossier <référence> pour consigner un consentement explicite, horodaté et révocable.';

/**
 * Moteur distant. Construit — le code existe, il est testé — mais chaque appel
 * revalide les DEUX verrous. Il n'y a pas d'état « déverrouillé » : oublier de
 * consentir au deuxième dossier ne doit pas hériter du consentement du premier.
 */
export function creerMoteurDistant(config: ConfigMoteurDistant): MoteurInference {
  return {
    descriptif: {
      type: 'distant',
      modele: config.modele,
      consentementDistant: config.consentement !== null,
    },

    async generer(instruction, contexte) {
      if (config.active !== 'oui') return { ok: false, erreur: REFUS_DISTANT_INACTIF };
      if (!config.consentement) return { ok: false, erreur: REFUS_SANS_CONSENTEMENT };
      if (!config.cleApi) {
        return { ok: false, erreur: "Mode distant : ANTHROPIC_API_KEY absente de l'environnement." };
      }

      const appel = config.fetchImpl ?? fetch;
      const controleur = new AbortController();
      const minuterie = setTimeout(() => controleur.abort(), config.delaiMs ?? 120_000);
      try {
        const reponse = await appel('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.cleApi,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: config.modele,
            max_tokens: 4096,
            system: instruction,
            messages: [{ role: 'user', content: contexte }],
          }),
          signal: controleur.signal,
        });

        if (!reponse.ok) {
          // Jamais le corps d'erreur amont : il peut refléter la requête (B11).
          return { ok: false, erreur: `Le service distant a répondu ${reponse.status}.` };
        }
        const charge = (await reponse.json()) as { content?: { type?: string; text?: string }[] };
        const texte = (charge.content ?? [])
          .filter((b) => b.type === 'text' && typeof b.text === 'string')
          .map((b) => b.text)
          .join('\n');
        if (!texte.trim()) return { ok: false, erreur: 'Réponse distante vide.' };
        return { ok: true, texte };
      } catch {
        return { ok: false, erreur: 'Service distant injoignable.' };
      } finally {
        clearTimeout(minuterie);
      }
    },
  };
}
