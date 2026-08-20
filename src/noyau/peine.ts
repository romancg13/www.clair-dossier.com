/**
 * DEFENSE OS — M7 : peine et mesures.
 *
 * ┌─ AUCUNE PRÉDICTION DE QUANTUM ──────────────────────────────────────────┐
 * │ Ce module liste les PARAMÈTRES DISCUTABLES et les PIÈCES À PRODUIRE.     │
 * │ Il ne dit jamais « vous risquez X » : un chiffre donnerait à une         │
 * │ discussion d'audience l'apparence d'un calcul (B4).                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import type { DossierPenal, Manque } from './modele';

export type VoletPeine = {
  intitule: string;
  /** Ce qui se discute à l'audience — en clair, sans chiffre. */
  discussion: string;
  /** Les pièces qui donnent corps à la discussion. */
  piecesAProduire: string[];
};

/**
 * Les volets de l'individualisation, tels que le dossier les ouvre. Les
 * volets patrimonial et douanier n'apparaissent que si la taxonomie du
 * dossier les porte : un volet sans objet est du bruit à l'audience.
 */
export function voletsPeine(dossier: DossierPenal): VoletPeine[] {
  const volets: VoletPeine[] = [
    {
      intitule: 'Garanties de représentation',
      discussion:
        "Domicile stable, activité, attaches familiales : chaque garantie documentée pèse contre le mandat de dépôt et pour l'aménagement.",
      piecesAProduire: [
        'Justificatif de domicile au nom du client ou attestation d’hébergement',
        'Contrat de travail, promesse d’embauche ou certificat de scolarité',
        'Attestations d’attaches familiales, charges de famille',
      ],
    },
    {
      intitule: 'Personnalité et parcours',
      discussion:
        "Le parcours antérieur et les démarches engagées depuis les faits se plaident sur pièces, pas sur déclarations.",
      piecesAProduire: [
        'Attestations d’employeurs, de formateurs, de proches',
        'Justificatifs de soins ou de suivi engagé, le cas échéant',
      ],
    },
    {
      intitule: 'Aménagements et alternatives',
      discussion:
        "Un cadre alternatif crédible (semi-liberté, détention à domicile, TIG selon le quantum prononcé) se propose construit : lieu, horaires, référent.",
      piecesAProduire: ['Éléments matérialisant le cadre proposé (logement, emploi, référent)'],
    },
    {
      intitule: 'Mandat de dépôt et période de sûreté',
      discussion:
        "Leur prononcé se discute distinctement de la peine : les garanties de représentation portent ici tout leur poids.",
      piecesAProduire: ['Les mêmes garanties, ordonnées pour cette discussion distincte'],
    },
  ];

  if (dossier.natures.includes('volet-patrimonial')) {
    volets.push({
      intitule: 'Confiscations et saisies',
      discussion:
        "Chaque bien visé se discute un à un : titularité réelle, lien avec les faits, proportionnalité.",
      piecesAProduire: ['Titres de propriété, justificatifs d’origine des fonds pour chaque bien visé'],
    });
  }
  if (dossier.natures.includes('volet-douanier')) {
    volets.push({
      intitule: 'Pénalités douanières',
      discussion:
        "L'assiette des pénalités se conteste avant leur principe : la valeur retenue doit être justifiée pièce à l'appui.",
      piecesAProduire: ['Éléments de valorisation contradictoires'],
    });
  }

  return volets;
}

/** Les manques que le volet peine révèle — remontent au pupitre comme les autres. */
export function manquesPeine(dossier: DossierPenal): Manque[] {
  const aDejaGaranties = dossier.pieces.some((p) => /attestation|domicile|travail|h[eé]bergement/i.test(p.intitule));
  if (aDejaGaranties) return [];
  return [
    {
      id: 'peine-garanties',
      nature: 'Aucune pièce de garantie de représentation versée',
      criticite: 'important',
      necessairePour: "la discussion sur la peine, le mandat de dépôt et l'aménagement",
      action: 'Demander au client justificatif de domicile, d’activité et attaches — le questionnaire client les liste.',
    },
  ];
}
