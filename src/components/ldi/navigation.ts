/**
 * Plan de navigation de l'atelier.
 *
 * ┌─ POURQUOI CE FICHIER EXISTE SÉPARÉMENT ─────────────────────────────────┐
 * │ Une entrée de menu qui mène à un écran vide est un mensonge d'interface. │
 * │ Le champ `etat` distingue ce qui est RÉELLEMENT branché sur le moteur de │
 * │ ce qui ne l'est pas, et la barre latérale l'affiche. Rien n'est masqué : │
 * │ l'avocat voit le périmètre visé et sait sur quoi il peut compter.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/** Identifiants de vue — repris tels quels dans l'URL (`?vue=`). */
export type Vue =
  | 'pupitre'
  | 'depot'
  | 'documents'
  | 'frise'
  | 'regularite'
  | 'preuve'
  | 'moyens'
  | 'ecritures'
  | 'registre'
  | 'bibliotheque'
  | 'sources'
  | 'journal'
  | 'confidentialite'
  | 'parametres';

export type EntreeNavigation = {
  vue: Vue;
  intitule: string;
  /** `prevu` : décrit au mandat, non branché. Affiché comme tel. */
  etat: 'actif' | 'prevu';
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
      { vue: 'pupitre', intitule: 'Pupitre', etat: 'actif', resume: 'Ce qui brûle, ce qui attend, où en est chaque dossier.' },
      { vue: 'depot', intitule: 'Dépôt', etat: 'actif', resume: 'Texte collé et fichiers — ingestion locale par niveaux (D-1).' },
      { vue: 'documents', intitule: 'Documents', etat: 'actif', resume: 'Pièces ingérées, empreintes, alertes B17, recherche plein texte.' },
      { vue: 'frise', intitule: 'Frise', etat: 'actif', resume: 'Actes en colonne chronologique, propagation des griefs.' },
    ],
  },
  {
    titre: 'Analyse',
    entrees: [
      { vue: 'regularite', intitule: 'Régularité', etat: 'actif', resume: 'Les quatorze postes : conforme, grief ou manque — jamais un silence.' },
      { vue: 'preuve', intitule: 'Preuve', etat: 'actif', resume: 'Ce que chaque élément établit, n’établit pas, et l’écart d’imputation.' },
      { vue: 'moyens', intitule: 'Moyens', etat: 'actif', resume: 'Ordre procédural, riposte prévisible et contre-riposte pour chacun.' },
      { vue: 'ecritures', intitule: 'Écritures', etat: 'actif', resume: 'Les neuf livrables, générés puis passés par la gate d’export.' },
    ],
  },
  {
    titre: 'Suivi',
    entrees: [
      { vue: 'registre', intitule: 'Demandes', etat: 'actif', resume: 'Chaque demande tracée de l’énoncé à la clôture — rien ne se perd.' },
      { vue: 'bibliotheque', intitule: 'Bibliothèque', etat: 'actif', resume: 'Consignes permanentes et trames du cabinet, versionnées.' },
      { vue: 'sources', intitule: 'Sources', etat: 'actif', resume: 'Pack produit par la CLI : références horodatées, entrées incomplètes rejetées.' },
      { vue: 'journal', intitule: 'Journal', etat: 'actif', resume: 'Traçabilité des passes et générations — identifiants, jamais de contenu.' },
    ],
  },
  {
    titre: 'Sécurité',
    entrees: [
      { vue: 'confidentialite', intitule: 'Minimisation', etat: 'actif', resume: 'Ce qui sortirait du poste, pseudonymisé — cet atelier n’envoie rien.' },
      { vue: 'parametres', intitule: 'Paramètres', etat: 'actif', resume: 'Coffre chiffré, niveau d’ingestion, cache, périmètre couvert.' },
    ],
  },
];

/**
 * Capacités décrites au mandat qui ne sont PAS couvertes par l'atelier.
 * Listées en clair plutôt que passées sous silence.
 */
export const CAPACITES_PREVUES: { intitule: string; pourquoi: string }[] = [
  {
    intitule: 'Recherche juridique en direct',
    pourquoi:
      "Les API officielles ne sont interrogeables que depuis la ligne de commande : l'atelier ne détient aucun code d'appel réseau (B7/B8). Les sources arrivent par le pack CLI, horodatées.",
  },
  {
    intitule: 'Inférence dans le navigateur',
    pourquoi:
      "Le moteur d'inférence (local ou distant) est piloté par la CLI (D-2/D-3). L'atelier travaille en mode déterministe — il n'est jamais inerte pour autant.",
  },
  {
    intitule: 'OCR de documents numérisés',
    pourquoi:
      'Écarté (D-1, niveau 2). Une page sans couche texte part en quarantaine, comptée et nommée — jamais devinée.',
  },
  {
    intitule: 'Détection de textes générés',
    pourquoi:
      "Écartée par principe (B5) : aucun outil ne détermine si un texte a été généré, et produire un tel score reviendrait à fournir une accusation non étayée.",
  },
];

export function entreePour(vue: Vue): EntreeNavigation | undefined {
  return NAVIGATION.flatMap((s) => s.entrees).find((e) => e.vue === vue);
}

const VUES = new Set(NAVIGATION.flatMap((s) => s.entrees.map((e) => e.vue)));

/** Ramène une valeur d'URL arbitraire à une vue connue. */
export function vueValide(valeur: string | null): Vue {
  return valeur !== null && VUES.has(valeur as Vue) ? (valeur as Vue) : 'pupitre';
}
