/**
 * DEFENSE OS — détection des instructions cachées (B17, §6.5).
 *
 * ┌─ CE QUE CE MODULE FAIT, ET SURTOUT CE QU'IL NE FAIT PAS ────────────────┐
 * │ Il DÉTECTE des passages qui ressemblent à des consignes adressées à une  │
 * │ machine, les CITE avec leur localisation exacte, et c'est tout. Il       │
 * │ n'exécute rien, ne supprime rien, ne réécrit rien : le passage reste     │
 * │ dans le texte de la pièce, traité comme n'importe quel texte de dossier. │
 * │                                                                          │
 * │ Retirer le passage serait pire que le garder : une écriture adverse qui  │
 * │ contient une consigne cachée est une INFORMATION pour l'avocat — la      │
 * │ faire disparaître, c'est détruire un indice.                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Les motifs sont un fil de détente lexical, pas une compréhension : ils
 * attrapent les tentatives franches, en français et en anglais. La vraie
 * garantie reste architecturale — aucun texte de pièce n'atteint JAMAIS un
 * moteur comme consigne, détecté ou non (cloisonnement de `prompt.ts`).
 */

export type AlerteInstruction = {
  /** Page (1-indexée) où le passage a été relevé. */
  page: number;
  /** Position du premier caractère dans le texte de la page. */
  position: number;
  /** Le passage, cité tel quel — c'est ce que l'avocat doit pouvoir lire. */
  passage: string;
  /** Ce qui a déclenché : le nom du motif, pas une accusation. */
  motif: string;
};

/**
 * Motifs relevés. Chacun est nommé pour que l'alerte dise POURQUOI le passage
 * ressemble à une consigne — un signalement inexplicable serait ignoré.
 */
const MOTIFS: { nom: string; motif: RegExp }[] = [
  {
    nom: 'demande d’ignorer des instructions',
    motif: /(ignore|oublie|disregard|forget)[^.\n]{0,40}(instructions?|consignes?|directives?|prompt)/iu,
  },
  {
    nom: 'adresse directe à un système ou assistant',
    motif: /\b(system|assistant|ai|ia|mod[eè]le|claude|gpt|llm)\s*[:\]]|en\s+tant\s+qu['’]?(ia|assistant|mod[eè]le)/iu,
  },
  {
    nom: 'balise de cloisonnement ou de rôle',
    motif: /<\s*\/?\s*(donnees_dossier|system|instructions?|prompt)\b[^>]*>|\[\s*(system|instructions?)\s*\]/iu,
  },
  {
    nom: 'injonction de révéler ou de reproduire une consigne',
    motif: /(r[eé]v[eè]le|affiche|reproduis|imprime|print|reveal)[^.\n]{0,40}(prompt|instructions?|consignes?|syst[eè]me)/iu,
  },
  {
    nom: 'consigne de production dissimulée',
    motif: /(tu\s+dois|you\s+must|r[eé]ponds\s+uniquement|answer\s+only|output\s+only)[^.\n]{0,60}/iu,
  },
];

/** Demi-fenêtre de citation autour du passage détecté. */
const CONTEXTE = 60;

/**
 * Balaie le texte d'une page. Chaque motif ne remonte qu'une fois par page :
 * un document piégé qui répète cent fois la même phrase produirait cent
 * alertes identiques, et cent alertes identiques ne se lisent pas.
 */
export function detecterInstructions(page: number, texte: string): AlerteInstruction[] {
  const alertes: AlerteInstruction[] = [];

  for (const { nom, motif } of MOTIFS) {
    const global = new RegExp(motif.source, motif.flags.includes('g') ? motif.flags : `${motif.flags}g`);
    const m = global.exec(texte);
    if (!m) continue;

    const debut = Math.max(0, m.index - CONTEXTE);
    const fin = Math.min(texte.length, m.index + m[0].length + CONTEXTE);
    alertes.push({
      page,
      position: m.index,
      passage: `${debut > 0 ? '…' : ''}${texte.slice(debut, fin).replace(/\s+/g, ' ').trim()}${fin < texte.length ? '…' : ''}`,
      motif: nom,
    });
  }

  return alertes;
}
