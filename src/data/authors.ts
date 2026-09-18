export type Author = {
  id: string;
  name: string;
  role: string;
  bio: string;
  initials: string;
};

/**
 * Auteurs du Journal. Règle : aucun auteur ni relecteur fictif. Tant qu'aucune
 * personne réelle n'est attestée dans le dépôt, les articles sont signés
 * « Équipe ClairDossier » (identifiant historique `redaction` conservé pour
 * la compatibilité des données).
 */
export const authors: Record<string, Author> = {
  redaction: {
    id: 'redaction',
    name: 'Équipe ClairDossier',
    role: 'Contenus pédagogiques',
    bio:
      "Articles rédigés par l'équipe ClairDossier à partir des textes officiels cités en sources. Contenus pédagogiques : ils ne constituent pas un conseil juridique personnalisé. ClairDossier ne lit pas les documents de ses utilisateurs.",
    initials: 'CD',
  },
};
