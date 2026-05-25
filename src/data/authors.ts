export type Author = {
  id: string;
  name: string;
  role: string;
  bio: string;
  initials: string;
};

export const authors: Record<string, Author> = {
  'helene-vasseur': {
    id: 'helene-vasseur',
    name: 'Maître Hélène Vasseur-Dupré',
    role: "Avocate associée · Responsable contenus juridiques ClairDossier",
    bio: "Avocate au barreau de Paris depuis 2012, spécialisée en droit social et droit du travail. Elle a co-fondé la cellule éditoriale ClairDossier pour traduire le droit professionnel en pédagogie accessible — sans simplifier ce qui compte. Diplômée du CAPA et titulaire d'un master 2 droit social Paris II Panthéon-Assas.",
    initials: 'HV',
  },
  'thomas-leclerc': {
    id: 'thomas-leclerc',
    name: 'Thomas Leclerc',
    role: 'Juriste IT · Responsable conformité ClairDossier',
    bio: "Juriste spécialisé en données personnelles depuis 2017, DPO certifié CNIL. Il accompagne les startups françaises sur leurs obligations RGPD et la sécurisation de leurs flux de données. Chez ClairDossier, il rédige les engagements de conformité et veille à ce que la déontologie technique aille aussi loin que la déontologie juridique.",
    initials: 'TL',
  },
};
