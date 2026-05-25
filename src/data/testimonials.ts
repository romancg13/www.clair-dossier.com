export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  role: string;
  context: string;
};

export const testimonials: Testimonial[] = [
  {
    id: 'avocat-droit-travail',
    quote:
      "Nos clients arrivent en consultation avec un dossier déjà ordonné. Cinq minutes au lieu de quarante. La marge dégagée, je la rends aux affaires complexes — celles où la qualité juridique fait la différence.",
    name: "Maître Hélène Vasseur-Dupré",
    role: "Avocate associée, droit du travail",
    context: "Cabinet Marais & Associés, 14 collaborateurs · Paris",
  },
  {
    id: 'particulier-prudhommes',
    quote:
      "J'avais classé mes courriers dans un dossier carton depuis deux ans. ClairDossier les a renommés, datés, mis dans l'ordre. Quand j'ai rencontré l'avocat, il a pu se concentrer sur la stratégie — pas sur reconstituer l'historique.",
    name: "Bertrand C.",
    role: "Particulier, dossier prud'homal",
    context: "Indemnité licenciement contestée · Saisine CPH de Lyon en cours",
  },
  {
    id: 'rh-pme',
    quote:
      "En tant que DRH, je suis l'interlocutrice de notre conseil pour 9 dossiers en parallèle. Avant, je passais une heure par semaine à les briefer par mail. Maintenant, le statut de chaque dossier est à jour en permanence — je ne suis plus la messagère.",
    name: "Sofia Berthelot",
    role: "DRH, PME industrielle 220 personnes",
    context: "Adhésion ClairDossier depuis 8 mois · Région Auvergne-Rhône-Alpes",
  },
];
