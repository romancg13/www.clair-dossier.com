/**
 * Plan de navigation de l'atelier LDI.
 *
 * ┌─ POURQUOI CE FICHIER EXISTE SÉPARÉMENT ─────────────────────────────────┐
 * │ Une entrée de menu qui mène à un écran vide est un mensonge d'interface. │
 * │ Le champ `etat` distingue donc ce qui est RÉELLEMENT branché sur le      │
 * │ moteur de ce qui ne l'est pas encore, et la barre latérale l'affiche.    │
 * │                                                                          │
 * │ Rien n'est masqué : l'avocat voit le périmètre complet visé et sait, à   │
 * │ chaque instant, ce sur quoi il peut compter aujourd'hui. Une capacité    │
 * │ annoncée qu'il croirait active est exactement le genre d'erreur qui se   │
 * │ découvre au pire moment.                                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/** Identifiants de vue — repris tels quels dans l'URL (`?vue=`). */
export type Vue =
  | 'tableau-de-bord'
  | 'depot'
  | 'dossiers'
  | 'chronologie'
  | 'controles'
  | 'strategie'
  | 'documents'
  | 'confidentialite'
  | 'parametres';

export type EntreeNavigation = {
  vue: Vue;
  intitule: string;
  /** `prevu` : décrit dans le cahier des charges, non branché. Affiché comme tel. */
  etat: 'actif' | 'prevu';
  /** Ce que la vue montre — sert d'aide contextuelle et de description accessible. */
  resume: string;
};

export type SectionNavigation = {
  titre: string;
  entrees: EntreeNavigation[];
};

export const NAVIGATION: SectionNavigation[] = [
  {
    titre: 'Espace de travail',
    entrees: [
      {
        vue: 'tableau-de-bord',
        intitule: 'Tableau de bord',
        etat: 'actif',
        resume: "Comptes de l'atelier et accès au dossier actif.",
      },
      {
        vue: 'depot',
        intitule: 'Dépôt de pièces',
        etat: 'actif',
        resume: 'Glisser-déposer des fichiers ou un répertoire ; extraction locale et mise en état.',
      },
      {
        vue: 'dossiers',
        intitule: 'Dossiers',
        etat: 'actif',
        resume: 'Classement par état, régime ou qualification.',
      },
      {
        vue: 'chronologie',
        intitule: 'Chronologie',
        etat: 'actif',
        resume: 'Événements datés du dossier actif et contradictions relevées.',
      },
    ],
  },
  {
    titre: 'Analyse',
    entrees: [
      {
        vue: 'controles',
        intitule: 'Points de contrôle',
        etat: 'actif',
        resume: 'Les dix contrôles procéduraux, leur résultat et leur fondement.',
      },
      {
        vue: 'strategie',
        intitule: 'Axes de défense',
        etat: 'actif',
        resume: "Axes, objections prévisibles, diligences et échéances.",
      },
      {
        vue: 'documents',
        intitule: 'Actes à préparer',
        etat: 'actif',
        resume: 'Trames de requête et de mémoire, à compléter par l’avocat.',
      },
    ],
  },
  {
    titre: 'Sécurité',
    entrees: [
      {
        vue: 'confidentialite',
        intitule: 'Minimisation',
        etat: 'actif',
        resume: 'Pseudonymisation avant tout envoi, et risques résiduels.',
      },
      {
        vue: 'parametres',
        intitule: 'Paramètres',
        etat: 'actif',
        resume: 'Conservation locale, cache d’analyse, périmètre couvert.',
      },
    ],
  },
];

/**
 * Capacités décrites au cahier des charges qui ne sont PAS implémentées.
 * Listées en clair dans la barre latérale plutôt que passées sous silence.
 */
export const CAPACITES_PREVUES: { intitule: string; pourquoi: string }[] = [
  {
    intitule: 'Recherche juridique en direct',
    pourquoi:
      "Les API officielles (Judilibre, Légifrance) ne sont interrogeables que depuis la ligne de commande : l'atelier ne détient aucun code d'appel réseau. Les sources arrivent par un pack produit par la CLI, avec leurs horodatages.",
  },
  {
    intitule: 'Personnes & relations',
    pourquoi: "Aucun module ne construit de graphe d'acteurs à ce jour.",
  },
  {
    intitule: 'Preuves',
    pourquoi: "La traçabilité des scellés est contrôlée, mais aucune vue dédiée n'existe.",
  },
  {
    intitule: 'Détection de textes générés',
    pourquoi:
      "Écartée par principe (règle B5) : aucun outil ne détermine si un texte a été généré, et produire un tel score reviendrait à fournir une accusation non étayée.",
  },
];

export function entreePour(vue: Vue): EntreeNavigation | undefined {
  return NAVIGATION.flatMap((s) => s.entrees).find((e) => e.vue === vue);
}

const VUES = new Set(NAVIGATION.flatMap((s) => s.entrees.map((e) => e.vue)));

/** Ramène une valeur d'URL arbitraire à une vue connue. */
export function vueValide(valeur: string | null): Vue {
  return valeur !== null && VUES.has(valeur as Vue) ? (valeur as Vue) : 'tableau-de-bord';
}
