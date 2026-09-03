export type Author = {
  id: string;
  name: string;
  role: string;
  bio: string;
  initials: string;
};

export const authors: Record<string, Author> = {
  redaction: {
    id: 'redaction',
    name: 'Rédaction ClairDossier',
    role: 'Cellule éditoriale',
    bio:
      "Articles écrits par l'équipe éditoriale ClairDossier, à partir de sources juridiques publiques (codes, décrets, règlements). Les contenus sont pédagogiques : ils ne constituent pas un conseil juridique personnalisé et n'engagent pas leurs auteurs.",
    initials: 'CD',
  },
};
