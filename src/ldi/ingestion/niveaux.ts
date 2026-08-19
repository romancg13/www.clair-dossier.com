/**
 * DEFENSE OS — niveaux d'ingestion (décision D-1 du mandat v4).
 *
 * ┌─ LA RÈGLE ──────────────────────────────────────────────────────────────┐
 * │ Niveau 0, TOUJOURS actif : texte collé et fichiers texte brut            │
 * │ (.txt, .md, .csv, .json). Lecture strictement locale.                    │
 * │                                                                          │
 * │ Niveau 1, DÉSACTIVÉ par défaut : extraction locale, sans OCR, des        │
 * │ formats à structure — PDF natif, documents bureautiques, courriels,      │
 * │ archives. Le code est livré et testé ; seul l'interrupteur le libère,    │
 * │ et son activation affiche un avertissement.                              │
 * │                                                                          │
 * │ Niveau 2 (OCR) : écarté. Il n'existe aucun chemin de code.               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Un fichier de niveau 1 déposé interrupteur fermé n'est pas ignoré : il est
 * REFUSÉ avec un motif qui dit quoi activer. Un dépôt silencieusement amputé
 * ferait croire à un dossier complet.
 */
import { ingerer } from './ingestion';
import { reconnaitreFormat } from './formats';
import {
  BORNES_DEFAUT,
  type BornesIngestion,
  type FichierEntrant,
  type FormatFichier,
  type ResultatIngestion,
} from './types';

/** Formats lisibles sans aucune dépendance, texte brut au sens strict. */
export const FORMATS_NIVEAU_0: readonly FormatFichier[] = ['texte', 'csv'];

/** Formats à structure, locaux et sans OCR — derrière l'interrupteur. */
export const FORMATS_NIVEAU_1: readonly FormatFichier[] = [
  'pdf',
  'docx',
  'tableur',
  'courriel',
  'archive',
];

export const AVERTISSEMENT_NIVEAU_1 =
  "L'extraction de documents à structure (PDF natif, bureautique, courriels, archives) est maintenant active. " +
  "Elle reste locale et sans OCR : les pages numérisées sans couche texte partent en quarantaine, comptées et nommées. " +
  'Ce niveau charge des extracteurs plus lourds à la demande.';

export type OptionsNiveaux = {
  /** Interrupteur du niveau 1 — FAUX par défaut (décision D-1). */
  niveau1Actif: boolean;
  bornes?: BornesIngestion;
};

/**
 * Ingestion cloisonnée par niveaux.
 *
 * Le tri se fait AVANT `ingerer` : un fichier refusé pour niveau ne doit même
 * pas être ouvert — ouvrir puis jeter reviendrait à lire ce que le réglage
 * promet de ne pas lire.
 */
export function ingererSelonNiveau(
  fichiers: FichierEntrant[],
  options: OptionsNiveaux
): ResultatIngestion {
  const bornes = options.bornes ?? BORNES_DEFAUT;
  const admis: FichierEntrant[] = [];
  const refusesNiveau: ResultatIngestion['refuses'] = [];

  for (const fichier of fichiers) {
    const format = reconnaitreFormat(fichier.nom, fichier.octets);
    const estNiveau1 = FORMATS_NIVEAU_1.includes(format);

    if (estNiveau1 && !options.niveau1Actif) {
      refusesNiveau.push({
        nomFichier: fichier.nom,
        chemin: fichier.chemin,
        motif:
          `Format « ${format} » : niveau 1 désactivé. L'ingestion active ne lit que le texte collé et les fichiers texte brut (.txt, .md, .csv, .json). ` +
          "Activer le niveau 1 dans Paramètres pour extraire ce document — en local, sans OCR.",
      });
      continue;
    }
    admis.push(fichier);
  }

  const resultat = ingerer(admis, bornes);
  resultat.refuses.push(...refusesNiveau);
  return resultat;
}

/**
 * Texte collé dans l'interface : l'entrée du niveau 0 qui ne passe par aucun
 * fichier. Le nom fourni sert de cote de travail — il vient de l'avocat.
 */
export function collerTexte(nom: string, texte: string): FichierEntrant {
  return {
    nom: nom.trim() || 'texte collé',
    chemin: '',
    octets: new TextEncoder().encode(texte),
  };
}
