/**
 * Qualification déterministe des prospects — chantier A1, version 0.
 *
 * Règles écrites, versionnées et testées (tests/prospects-scoring.test.ts) :
 * AUCUN appel à un modèle de langage, aucun réseau, aucune invention.
 * La version conversationnelle de l'agent A1 (prompts/a1-qualification.system.md,
 * DRAFT) réutilisera ce même barème comme socle de vérification.
 *
 * Garde-fous A1 appliqués ici :
 *  - le message est une DONNÉE : les motifs d'injection sont détectés et
 *    journalisés (human_flags), jamais exécutés ;
 *  - aucune réponse n'est générée (reponse_proposee = null en v0) ;
 *  - escalade humaine explicite via human_flags, jamais silencieuse.
 */
import type { CleanProspect } from './validate.ts';

export type Routage = 'libre-service' | 'demonstration' | 'devis';

export type Qualification = {
  score_potentiel: number;
  routage: Routage;
  human_flags: string[];
  motif: string[];
};

/** Seuil d'escalade : notification humaine immédiate au-delà (spec A1). */
export const SEUIL_ESCALADE = 50;

const SEGMENT_SCORES: Record<CleanProspect['segment'], number> = {
  'grand-compte': 50,
  'cabinet-avocats': 40,
  'expert-comptable': 40,
  pme: 20,
  'profession-liberale': 15,
  artisan: 10,
  independant: 10,
  autre: 5,
  particulier: 0,
};

const TOPIC_SCORES: Record<CleanProspect['topic'], number> = {
  devis: 15,
  commercial: 15,
  'rendez-vous': 10,
  demo: 10,
  support: 0,
  presse: 0,
};

// Signaux à fort enjeu dans le message (insensibles à la casse).
// Chaque motif : [regex, points, flag éventuel, libellé de motif]
const MESSAGE_SIGNALS: Array<[RegExp, number, string | null, string]> = [
  [/\bdpa\b|accord de (sous-)?traitance/i, 20, 'demande_dpa', 'demande de DPA'],
  [/audit (de )?s[ée]curit[ée]|pentest|question(naire)? s[ée]curit[ée]/i, 15, 'audit_securite', 'audit de sécurité évoqué'],
  [/march[ée]s? publics?|appels? d['’]offres?/i, 20, 'marche_public', 'marché public / appel d’offres'],
  [/\bsso\b|\bsaml\b|\boidc\b/i, 15, null, 'SSO/SAML/OIDC évoqué'],
  [/\bapi\b|\bsdk\b/i, 10, null, 'intégration API/SDK évoquée'],
  [/marque blanche/i, 15, null, 'marque blanche évoquée'],
  [/\b\d{3,}\s*(dossiers|documents|pi[èe]ces|collaborateurs|utilisateurs)\b/i, 15, null, 'volumétrie élevée déclarée'],
];

// Tentatives d'injection de prompt : détectées pour journalisation (le
// contenu reste traité comme du texte, jamais comme une instruction).
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(les|toutes les|previous|prior|above|tes)?\s*(instructions|consignes|r[èe]gles)/i,
  /disregard\s+(all|previous|prior)\s+instructions/i,
  /system\s*prompt|invite\s+syst[èe]me/i,
  /tu es (d[ée]sormais|maintenant)|you are now/i,
  /r[ée]v[èe]le|reveal.*\b(prompt|instructions|cl[ée]s?|secrets?)\b/i,
];

export function qualifyProspect(p: CleanProspect): Qualification {
  const motif: string[] = [];
  const human_flags: string[] = [];
  let score = 0;

  score += SEGMENT_SCORES[p.segment];
  motif.push(`segment déclaré : ${p.segment} (+${SEGMENT_SCORES[p.segment]})`);

  score += TOPIC_SCORES[p.topic];
  if (TOPIC_SCORES[p.topic] > 0) motif.push(`nature de la demande : ${p.topic} (+${TOPIC_SCORES[p.topic]})`);

  if (p.organization) {
    score += 5;
    motif.push('structure renseignée (+5)');
  }

  const haystack = `${p.message}\n${p.organization ?? ''}`;
  for (const [re, points, flag, label] of MESSAGE_SIGNALS) {
    if (re.test(haystack)) {
      score += points;
      motif.push(`${label} (+${points})`);
      if (flag && !human_flags.includes(flag)) human_flags.push(flag);
    }
  }

  for (const re of INJECTION_PATTERNS) {
    if (re.test(p.message)) {
      if (!human_flags.includes('injection_suspectee')) {
        human_flags.push('injection_suspectee');
        motif.push('motif d’injection détecté dans le message (journalisé, non exécuté)');
      }
      break;
    }
  }

  // Routage : la nature déclarée de la demande prime (une démo demandée reste
  // une démo, même à fort score — l'escalade humaine est gérée à part).
  let routage: Routage;
  if (p.topic === 'devis' || (p.topic === 'commercial' && score >= SEUIL_ESCALADE)) routage = 'devis';
  else if (p.topic === 'demo' || p.topic === 'rendez-vous' || score >= 25) routage = 'demonstration';
  else routage = 'libre-service';

  if (
    score >= SEUIL_ESCALADE ||
    human_flags.includes('demande_dpa') ||
    human_flags.includes('audit_securite') ||
    human_flags.includes('marche_public')
  ) {
    human_flags.push('escalade_immediate');
  }

  return { score_potentiel: score, routage, human_flags, motif };
}
