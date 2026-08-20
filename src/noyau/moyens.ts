/**
 * DEFENSE OS — M6 : moyens hiérarchisés, avec la passe P5 (contradiction).
 *
 * ┌─ L'ORDRE EST PROCÉDURAL, JAMAIS « PAR CHANCES » ────────────────────────┐
 * │ In limine litis → nullités → contestation de l'imputation →              │
 * │ requalification → subsidiaire sur la peine. C'est l'ordre dans lequel    │
 * │ les moyens se soulèvent, pas un classement de valeur (B4).               │
 * │                                                                          │
 * │ P5 : CHAQUE moyen porte sa riposte prévisible et sa contre-riposte. Un   │
 * │ moyen qui n'en a pas est marqué incomplet — et la gate d'export le       │
 * │ bloque déjà. La riposte n'est pas un ornement : c'est l'audience jouée   │
 * │ une fois à blanc.                                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import type { PosteRegularite } from './postes';
import type { AnalysePreuve } from './preuve';
import type { AnalyseQualification } from './qualification';
import { ORDRE_MOYENS, type CategorieMoyen, type DossierPenal, type Moyen } from './modele';
import { MOTEUR_DETERMINISTE, scellerSortie, type SortiePasse } from './passes';

/**
 * Ripostes types par catégorie — la contradiction que le parquet oppose
 * presque toujours, et la contre-riposte qui doit être prête. Formulations
 * FONCTIONNELLES, sans texte cité (B2).
 */
const CONTRADICTIONS: Record<CategorieMoyen, { riposte: string; contre: string }> = {
  'in-limine-litis': {
    riposte: 'Le parquet soutiendra que le moyen est tardif ou couvert par la purge.',
    contre: "Établir la date de première connaissance de l'irrégularité et le premier moment utile pour la soulever.",
  },
  nullite: {
    riposte: "Le parquet contestera le grief : l'irrégularité n'aurait causé aucune atteinte aux intérêts du client.",
    contre: "Articuler l'atteinte concrète — ce que le client a perdu ou subi À CAUSE de l'irrégularité — pièce par pièce, et viser les actes subséquents.",
  },
  imputation: {
    riposte: 'Le parquet invoquera le faisceau : chaque élément serait corroboré par les autres.',
    contre: 'Défaire le faisceau élément par élément : un faisceau de rattachements fragiles ne devient pas solide par accumulation.',
  },
  requalification: {
    riposte: "Le parquet soutiendra que les éléments de la qualification poursuivie sont réunis.",
    contre: "Ramener le débat à l'élément constitutif manquant, nommé, et à l'absence de cote qui l'établirait.",
  },
  peine: {
    riposte: 'Le parquet mettra en avant la gravité des faits et les antécédents.',
    contre: 'Documenter les garanties de représentation et les éléments de personnalité, pièce par pièce, et proposer un cadre alternatif crédible.',
  },
};

/**
 * Construit les moyens depuis les analyses des passes précédentes, puis les
 * ordonne. Chaque moyen naît AVEC sa riposte et sa contre-riposte (P5) :
 * il n'existe pas d'état intermédiaire « moyen sans contradiction ».
 */
export function construireMoyens(
  postes: PosteRegularite[],
  preuves: AnalysePreuve[],
  qualifications: AnalyseQualification[]
): Moyen[] {
  const moyens: Moyen[] = [];
  let n = 0;
  const prochain = () => `MY${++n}`;

  // ── Nullités : un moyen par grief de la grille ─────────────────────────
  for (const poste of postes) {
    for (const grief of poste.griefs) {
      moyens.push({
        id: prochain(),
        categorie: 'nullite',
        enonce: `${grief.enonce}`,
        appuis: grief.appuis,
        references: [],
        ripostePrevue: CONTRADICTIONS.nullite.riposte,
        contreRiposte: CONTRADICTIONS.nullite.contre,
        consequenceRecherchee:
          grief.actesAffectes.length > 0
            ? `Annulation de l'acte et des actes subséquents (${grief.actesAffectes.join(', ')}).`
            : "Annulation de l'acte et retrait des pièces qui en procèdent.",
      });
    }
  }

  // ── Imputation : un moyen par élément dont l'écart est documenté ───────
  for (const analyse of preuves) {
    moyens.push({
      id: prochain(),
      categorie: 'imputation',
      enonce: `Contestation de la portée de l'élément « ${analyse.type} » : ${analyse.netablitPas}`,
      appuis: analyse.appuis,
      references: [],
      ripostePrevue: CONTRADICTIONS.imputation.riposte,
      contreRiposte: CONTRADICTIONS.imputation.contre,
      consequenceRecherchee: "Écarter l'élément du soutien de l'imputation personnelle.",
    });
  }

  // ── Requalification : une piste par qualification qui en porte une ─────
  for (const analyse of qualifications) {
    if (analyse.qualification.elementsManquants.length > 0) {
      moyens.push({
        id: prochain(),
        categorie: 'requalification',
        enonce: `Élément constitutif non établi pour « ${analyse.qualification.intituleFonctionnel} » : ${analyse.qualification.elementsManquants[0]}.${analyse.requalification ? ` ${analyse.requalification}` : ''}`,
        appuis: [analyse.qualification.id],
        references: [],
        ripostePrevue: CONTRADICTIONS.requalification.riposte,
        contreRiposte: CONTRADICTIONS.requalification.contre,
        consequenceRecherchee: 'Relaxe sur la qualification poursuivie, ou requalification vers l’infraction réellement établie.',
      });
    }
  }

  return ordonnerMoyens(moyens);
}

/** Tri par ordre procédural, stable à l'intérieur d'une catégorie. */
export function ordonnerMoyens(moyens: Moyen[]): Moyen[] {
  const rang = new Map(ORDRE_MOYENS.map((c, i) => [c, i]));
  return [...moyens].sort((a, b) => (rang.get(a.categorie) ?? 99) - (rang.get(b.categorie) ?? 99));
}

/** Un moyen est complet quand P5 a produit ses deux faces. */
export function moyenComplet(moyen: Moyen): boolean {
  return moyen.ripostePrevue.trim() !== '' && moyen.contreRiposte.trim() !== '';
}

/** P5 : contrôle de contradiction sur des moyens existants, scellé. */
export function executerP5(dossier: DossierPenal, moyens: Moyen[], horodatage?: string): {
  complets: Moyen[];
  incomplets: Moyen[];
  sortie: SortiePasse;
} {
  const complets = moyens.filter(moyenComplet);
  const incomplets = moyens.filter((m) => !moyenComplet(m));

  const sortie = scellerSortie(
    'P5',
    dossier,
    complets.map((m) => ({
      enonce: `[${m.id} · ${m.categorie}] ${m.enonce} — riposte anticipée : ${m.ripostePrevue}`,
      appuis: m.appuis,
    })),
    {
      moteur: MOTEUR_DETERMINISTE,
      traite: moyens.map((m) => m.id),
      identifiantsSupplementaires: [...dossier.qualificationsEnvisagees.map((q) => q.id), ...moyens.map((m) => m.id)],
      manques: incomplets.map((m) => ({
        quoi: `Moyen ${m.id} sans riposte anticipée`,
        necessairePour: `l'export de tout livrable portant le moyen ${m.id}`,
        action: 'Formuler la riposte prévisible du parquet et la contre-riposte — la gate bloque tant qu’elles manquent.',
      })),
      ouvert: incomplets.map((m) => `Moyen ${m.id} incomplet (P5) : export bloqué.`),
      horodatage,
    }
  );

  return { complets, incomplets, sortie };
}
