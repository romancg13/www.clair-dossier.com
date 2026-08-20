/**
 * DEFENSE OS — passe P0, l'ingestion comme passe (§3.2).
 *
 * P0 ne qualifie rien : elle ingère selon le niveau actif (D-1), fragmente,
 * indexe, détecte les instructions cachées (B17) et déclare ce qu'elle a
 * traité, écarté et laissé ouvert. Le texte source reste intact de bout en
 * bout — l'ingestion conserve, elle ne trie pas.
 */
import { detecterInstructions, type AlerteInstruction } from '../ldi/ingestion/instructions-cachees';
import { fragmenter, type Fragment } from '../ldi/ingestion/fragments';
import { ingererSelonNiveau, type OptionsNiveaux } from '../ldi/ingestion/niveaux';
import type { FichierEntrant, PieceIngeree, ResultatIngestion } from '../ldi/ingestion/types';
import { MOTEUR_DETERMINISTE, scellerSortie, type SortiePasse } from './passes';
import type { DossierPenal } from './modele';

/** Un document du dossier, tel que P0 le livre au greffe (P1). */
export type DocumentIngere = {
  /** Empreinte du contenu — c'est l'identifiant, stable entre deux dépôts. */
  id: string;
  nom: string;
  origine: 'dossier' | 'cabinet';
  format: string;
  dateAjout: string;
  empreinte: string;
  modeEntree: 'colle' | 'fichier';
  etatIndexation: 'indexe' | 'partiel' | 'quarantaine';
  /** Passages ressemblant à des consignes machine — cités, jamais exécutés. */
  alertesInstructions: AlerteInstruction[];
  fragments: Fragment[];
  pagesEnQuarantaine: number;
};

export type ResultatP0 = {
  documents: DocumentIngere[];
  ingestion: ResultatIngestion;
  sortie: SortiePasse;
};

/**
 * Convertit les pièces d'une ingestion (dérivées comprises) en documents.
 * Exporté pour l'interface : le dépôt fait sa propre ingestion en deux passes
 * (extraction différée) puis livre les documents au même format que P0.
 */
export function documentsDepuisIngestion(
  ingestion: ResultatIngestion,
  maintenant: string,
  modeEntree: 'colle' | 'fichier'
): DocumentIngere[] {
  const toutes = (pieces: PieceIngeree[]): PieceIngeree[] =>
    pieces.flatMap((p) => [p, ...toutes(p.derivees)]);
  return toutes(ingestion.pieces).map((p) => versDocument(p, maintenant, modeEntree));
}

function versDocument(piece: PieceIngeree, maintenant: string, modeEntree: 'colle' | 'fichier'): DocumentIngere {
  const fragments = fragmenter(piece);
  const alertes = piece.pages.flatMap((p) => detecterInstructions(p.page, p.texte));
  const quarantaine = piece.pages.filter((p) => p.quarantaine).length;

  return {
    id: piece.empreinte,
    nom: piece.nomFichier,
    origine: 'dossier',
    format: piece.format,
    dateAjout: maintenant,
    empreinte: piece.empreinte,
    modeEntree,
    etatIndexation: quarantaine === piece.pages.length ? 'quarantaine' : quarantaine > 0 ? 'partiel' : 'indexe',
    alertesInstructions: alertes,
    fragments,
    pagesEnQuarantaine: quarantaine,
  };
}

/**
 * Exécute P0 sur un lot de fichiers.
 *
 * La sortie de passe déclare : chaque document traité (par empreinte), les
 * refus et doublons dans `ecarte` avec leur motif, les pages en quarantaine
 * dans `manques` (elles appellent un geste : version native ou saisie), et
 * les alertes B17 dans `ouvert` — signalées, pas résolues.
 */
export function executerP0(
  dossier: DossierPenal,
  fichiers: FichierEntrant[],
  options: OptionsNiveaux & { maintenant?: string; modeEntree?: 'colle' | 'fichier' }
): ResultatP0 {
  const maintenant = options.maintenant ?? new Date().toISOString();
  const ingestion = ingererSelonNiveau(fichiers, options);
  const documents = documentsDepuisIngestion(ingestion, maintenant, options.modeEntree ?? 'fichier');

  const sortie = scellerSortie(
    'P0',
    dossier,
    // P0 n'énonce RIEN sur le fond : ses « résultats » sont les documents
    // ingérés eux-mêmes, chacun appuyé sur sa propre empreinte.
    documents.map((d) => ({
      enonce: `Document « ${d.nom} » ingéré : ${d.fragments.length} fragment(s), ${d.pagesEnQuarantaine} page(s) en quarantaine.`,
      appuis: [d.id],
    })),
    {
      moteur: MOTEUR_DETERMINISTE,
      traite: documents.map((d) => d.id),
      identifiantsSupplementaires: documents.map((d) => d.id),
      manques: documents
        .filter((d) => d.pagesEnQuarantaine > 0)
        .map((d) => ({
          quoi: `${d.pagesEnQuarantaine} page(s) non lue(s) dans « ${d.nom} »`,
          necessairePour: 'toute analyse qui s’appuierait sur ces pages',
          action: 'Obtenir la version native du document, ou saisir le texte manquant.',
        })),
      ecarte: [
        ...ingestion.refuses.map((r) => ({
          quoi: `${r.chemin ? `${r.chemin}/` : ''}${r.nomFichier}`,
          motif: r.motif,
        })),
        ...ingestion.doublons.map((d) => ({
          quoi: `${d.chemin ? `${d.chemin}/` : ''}${d.nomFichier}`,
          motif: `Doublon exact de ${d.identiqueA} : un seul exemplaire est versé.`,
        })),
      ],
      ouvert: documents
        .flatMap((d) =>
          d.alertesInstructions.map(
            (a) => `B17 · « ${d.nom} » p.${a.page} — ${a.motif} : « ${a.passage} »`
          )
        ),
      horodatage: maintenant,
    }
  );

  return { documents, ingestion, sortie };
}
