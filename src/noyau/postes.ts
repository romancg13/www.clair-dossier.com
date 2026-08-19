/**
 * DEFENSE OS — M3 : grille de régularité procédurale, quatorze postes (§7.3).
 *
 * ┌─ LA RÈGLE D'OR DU MODULE ───────────────────────────────────────────────┐
 * │ Chaque poste rend un constat, un grief ou un manque — JAMAIS un silence. │
 * │ Un poste sans matière ne disparaît pas : il dit qu'aucun acte de son     │
 * │ champ n'est recensé, et ce que l'avocat doit saisir si le dossier en     │
 * │ révèle. Le silence d'une grille de contrôle est sa pire sortie : il se   │
 * │ lit comme un satisfecit.                                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Chaque poste expose, dans l'ordre du mandat : ce qui DOIT figurer au
 * dossier / ce qui Y FIGURE (ancré) / ce qui MANQUE (avec le geste) / le
 * GRIEF envisageable / les actes subséquents affectés.
 *
 * Les intitulés sont FONCTIONNELS : aucun article n'est écrit ici (B2). Les
 * six contrôles horodatés de la garde à vue, le contrôle d'identité, la
 * perquisition, les scellés et la prescription restent calculés par le module
 * existant (`ldi/modules/nullites.ts`) et sont VERSÉS dans les postes 1, 2,
 * 3, 5 et 6 — la grille ne recalcule pas ce qui l'est déjà, elle le classe et
 * le complète.
 */
import type { AnalyseDossier, PointControle, RapportNullites } from '../ldi/types';
import type { DossierPenal, Manque } from './modele';
import { actesContamines } from './modele';
import { MOTEUR_DETERMINISTE, scellerSortie, type SortiePasse } from './passes';

export type ElementPresent = {
  element: string;
  /** Identifiants d'appui — cote, acte, mesure, événement. */
  appuis: string[];
};

export type GriefEnvisage = {
  enonce: string;
  appuis: string[];
  /** Actes subséquents que le grief contaminerait s'il prospère. */
  actesAffectes: string[];
};

export type PosteRegularite = {
  numero: number;
  id: string;
  intitule: string;
  /** Ce qui doit figurer au dossier pour que le poste soit contrôlable. */
  attendu: string[];
  present: ElementPresent[];
  manques: Manque[];
  griefs: GriefEnvisage[];
  /** Jamais « silence » : la synthèse est l'un de ces trois états. */
  synthese: 'constat' | 'grief' | 'manque';
  /** Le constat en clair — y compris « aucun acte de ce champ recensé ». */
  constat: string;
};

type Contexte = {
  dossier: DossierPenal;
  analyse: AnalyseDossier;
  nullites: RapportNullites;
};

// ---------------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------------

function actesDeType(dossier: DossierPenal, motif: RegExp) {
  return dossier.actes.filter((a) => motif.test(a.type));
}

function manque(nature: string, necessairePour: string, action: string, criticite: Manque['criticite'] = 'important'): Manque {
  return { id: `mq-${nature.slice(0, 24).replace(/\W+/g, '-').toLowerCase()}`, nature, criticite, necessairePour, action };
}

/** Verse les contrôles calculés (module existant) dans un poste. */
function verserControles(ctx: Contexte, prefixes: string[]): {
  present: ElementPresent[];
  manques: Manque[];
  griefs: GriefEnvisage[];
} {
  const concernes = ctx.nullites.points.filter((p) => prefixes.some((x) => p.id.startsWith(x)));
  const present: ElementPresent[] = [];
  const manques: Manque[] = [];
  const griefs: GriefEnvisage[] = [];

  for (const point of concernes) {
    if (point.resultat === 'conforme') {
      present.push({ element: `${point.id} — ${point.constat}`, appuis: appuisDuPoint(ctx, point) });
    } else if (point.resultat === 'anomalie') {
      griefs.push({ enonce: `${point.id} — ${point.constat}`, appuis: appuisDuPoint(ctx, point), actesAffectes: [] });
    } else {
      manques.push(
        manque(
          `${point.id} — ${point.intitule} : non établi`,
          point.intitule,
          point.actionSuggeree,
          'important'
        )
      );
    }
  }
  return { present, manques, griefs };
}

/**
 * Appuis d'un contrôle calculé : les événements de la mesure qu'il inspecte.
 * À défaut, les pièces sources — un contrôle a toujours porté sur quelque
 * chose d'identifiable.
 */
function appuisDuPoint(ctx: Contexte, point: PointControle): string[] {
  if (point.id.startsWith('GAV')) {
    const ids = ctx.dossier.evenements
      .filter((e) => e.nature.includes('garde-a-vue') || e.nature.includes('droits') || e.nature.includes('avocat') || e.nature === 'audition' || e.nature === 'examen-medical')
      .map((e) => e.id);
    if (ids.length > 0) return ids;
  }
  if (point.id.startsWith('CTRL')) {
    const ids = ctx.dossier.evenements.filter((e) => e.nature === 'controle-identite').map((e) => e.id);
    if (ids.length > 0) return ids;
  }
  if (point.id.startsWith('PERQ')) {
    const ids = ctx.dossier.evenements.filter((e) => e.nature === 'perquisition').map((e) => e.id);
    if (ids.length > 0) return ids;
  }
  return ctx.dossier.pieces.slice(0, 1).map((p) => p.id);
}

/** Grief type sur l'autorisation préalable d'un acte qui l'exige. */
function griefAutorisation(ctx: Contexte, motifType: RegExp, champ: string): {
  present: ElementPresent[];
  manques: Manque[];
  griefs: GriefEnvisage[];
  recenses: number;
} {
  const actes = actesDeType(ctx.dossier, motifType);
  const present: ElementPresent[] = [];
  const manques: Manque[] = [];
  const griefs: GriefEnvisage[] = [];

  for (const acte of actes) {
    if (acte.autorisationPrealable === 'oui') {
      present.push({ element: `${acte.type} du ${acte.dateHeure ?? '[non daté]'} : autorisation préalable documentée.`, appuis: [acte.id, ...acte.cotes] });
    } else if (acte.autorisationPrealable === 'non') {
      griefs.push({
        enonce: `${acte.type} (${acte.id}) réalisé sans autorisation préalable documentée — grief envisageable sur ${champ}.`,
        appuis: [acte.id, ...acte.cotes],
        actesAffectes: acte.actesSubsequents,
      });
    } else {
      manques.push(
        manque(
          `Autorisation préalable de « ${acte.type} » (${acte.id}) : inconnue`,
          `grief éventuel sur ${champ}`,
          `Demander la décision d'autorisation et sa motivation, ou constater son absence au dossier.`,
          'bloquant'
        )
      );
    }
    if (!acte.dateHeure) {
      manques.push(
        manque(
          `Horodatage de « ${acte.type} » (${acte.id}) : absent`,
          'tout contrôle de chronologie sur cet acte',
          "Rechercher l'heure exacte dans les PV, ou la réclamer.",
          'important'
        )
      );
    }
  }
  return { present, manques, griefs, recenses: actes.length };
}

// ---------------------------------------------------------------------------
// Les quatorze postes
// ---------------------------------------------------------------------------

type Definition = {
  numero: number;
  id: string;
  intitule: string;
  attendu: string[];
  evaluer(ctx: Contexte): { present: ElementPresent[]; manques: Manque[]; griefs: GriefEnvisage[]; constat?: string };
};

const DEFINITIONS: Definition[] = [
  {
    numero: 1,
    id: 'ORIGINE',
    intitule: "Origine et cadre de l'enquête",
    attendu: [
      "Le point de départ de l'enquête (plainte, dénonciation, constatation, information anonyme)",
      'Le cadre procédural et sa durée, avec ses éventuels changements',
      "La régularité du passage d'un cadre à l'autre",
    ],
    evaluer(ctx) {
      const verse = verserControles(ctx, ['PRESC']);
      const present = [...verse.present];
      const manques = [...verse.manques];

      if (ctx.dossier.cadreProcedural.trim()) {
        present.push({ element: `Cadre procédural renseigné : ${ctx.dossier.cadreProcedural}.`, appuis: ctx.dossier.pieces.slice(0, 1).map((p) => p.id) });
      } else {
        manques.push(
          manque(
            'Cadre procédural non renseigné',
            'la lecture de tous les autres postes — les règles applicables en dépendent',
            "Qualifier le cadre (flagrance, préliminaire, instruction, commission rogatoire) d'après les premières cotes.",
            'bloquant'
          )
        );
      }
      const origine = ctx.dossier.faits.find((f) => /origine|d[eé]nonciation|signalement|plainte/i.test(f.enonce));
      if (origine) {
        present.push({ element: `Point de départ documenté : ${origine.enonce}`, appuis: [origine.id, ...origine.cotes] });
      } else {
        manques.push(
          manque(
            "Point de départ de l'enquête non identifié",
            "le contrôle d'une éventuelle information anonyme comme fondement exclusif",
            'Identifier la première cote et la circonstance qui a ouvert l’enquête.',
            'important'
          )
        );
      }
      return { present, manques, griefs: verse.griefs };
    },
  },
  {
    numero: 2,
    id: 'INTERPELLATION',
    intitule: 'Interpellation',
    attendu: [
      "Les circonstances de l'interpellation et l'heure exacte",
      'Le fondement (flagrance alléguée, contrôle préalable)',
      "L'usage de la force, s'il y en a eu, et sa proportionnalité",
    ],
    evaluer(ctx) {
      const verse = verserControles(ctx, ['CTRL']);
      const auto = griefAutorisation(ctx, /interpellation|arrestation/i, "les conditions de l'interpellation");
      const constat =
        auto.recenses === 0 && ctx.dossier.evenements.every((e) => e.nature !== 'interpellation')
          ? "Aucune interpellation recensée dans les actes saisis. Si le dossier en révèle une, la saisir comme acte avec son heure exacte."
          : undefined;
      return { present: [...verse.present, ...auto.present], manques: [...verse.manques, ...auto.manques], griefs: [...verse.griefs, ...auto.griefs], constat };
    },
  },
  {
    numero: 3,
    id: 'GARDE-A-VUE',
    intitule: 'Garde à vue',
    attendu: [
      "Notification des droits et son heure",
      'Avis aux tiers (proche, employeur, autorité consulaire)',
      "Examen médical demandé ou d'office",
      "Entretien avec l'avocat et assistance aux auditions",
      'Repos, alimentation, prolongations et leurs autorisations, transports',
    ],
    evaluer(ctx) {
      return verserControles(ctx, ['GAV']);
    },
  },
  {
    numero: 4,
    id: 'AUDITIONS',
    intitule: 'Auditions',
    attendu: [
      'Horodatage de début et de fin de chaque audition',
      'Fidélité de la retranscription (enregistrement le cas échéant)',
      "Vulnérabilité, interprétariat, minorité : constatés et pris en compte",
    ],
    evaluer(ctx) {
      const auditions = ctx.dossier.evenements.filter((e) => e.nature === 'audition' || e.nature === 'confrontation');
      const present: ElementPresent[] = [];
      const manques: Manque[] = [];

      for (const a of auditions) {
        const heureComplete = /T\d{2}:\d{2}/.test(a.horodatage);
        if (heureComplete) {
          present.push({ element: `Audition « ${a.description} » horodatée (${a.horodatage}).`, appuis: [a.id, a.sourcePieceId].filter(Boolean) as string[] });
        } else {
          manques.push(
            manque(
              `Audition « ${a.description} » sans heure exploitable`,
              'le contrôle du délai de carence et de la durée des auditions',
              'Relever l’heure de début et de fin sur le PV d’audition.',
              'important'
            )
          );
        }
      }
      const constat = auditions.length === 0
        ? 'Aucune audition recensée dans les événements saisis. Saisir chaque audition avec ses heures de début et de fin.'
        : undefined;
      return { present, manques, griefs: [], constat };
    },
  },
  {
    numero: 5,
    id: 'PERQUISITIONS',
    intitule: 'Perquisitions et visites',
    attendu: [
      "Assentiment exprès ou autorisation, selon le cadre",
      "Présence de l'occupant ou de deux témoins",
      'Horaires légaux, périmètre, inventaire',
    ],
    evaluer(ctx) {
      const verse = verserControles(ctx, ['PERQ']);
      const auto = griefAutorisation(ctx, /perquisition|visite/i, 'la régularité de la perquisition');
      return { present: [...verse.present, ...auto.present], manques: [...verse.manques, ...auto.manques], griefs: [...verse.griefs, ...auto.griefs] };
    },
  },
  {
    numero: 6,
    id: 'SCELLES',
    intitule: 'Saisies et scellés',
    attendu: [
      'Désignation précise de chaque scellé',
      'Chaîne de conservation continue, ouvertures ultérieures documentées',
      'Destruction anticipée du produit : procédure suivie ; restitutions',
    ],
    evaluer(ctx) {
      const verse = verserControles(ctx, ['PREUVE']);
      const present = [...verse.present];
      const manques = [...verse.manques];
      const griefs = [...verse.griefs];

      for (const scelle of ctx.dossier.scelles) {
        if (scelle.chaineConservation.length === 0) {
          manques.push(
            manque(
              `Scellé « ${scelle.designation} » : chaîne de conservation non documentée`,
              "l'intégrité de la preuve matérielle",
              'Réclamer les PV d’ouverture et de reconditionnement du scellé.',
              'bloquant'
            )
          );
        } else {
          present.push({ element: `Scellé « ${scelle.designation} » : ${scelle.chaineConservation.length} opération(s) de conservation documentée(s).`, appuis: [scelle.id] });
        }
      }
      return { present, manques, griefs };
    },
  },
  {
    numero: 7,
    id: 'MESURES-TECHNIQUES',
    intitule: 'Mesures techniques',
    attendu: [
      'Autorisation préalable écrite pour chaque mesure (géolocalisation, interception, sonorisation, captation)',
      'Motivation, durée et périmètre de l’autorisation',
    ],
    evaluer(ctx) {
      const auto = griefAutorisation(ctx, /g[eé]olocalisation|interception|sonorisation|captation|balise/i, 'la régularité de la mesure technique');
      const constat = auto.recenses === 0
        ? 'Aucune mesure technique recensée dans les actes saisis. Si le dossier en révèle (géolocalisation, écoutes, sonorisation), les saisir comme actes avec leur autorisation.'
        : undefined;
      return { ...auto, constat };
    },
  },
  {
    numero: 8,
    id: 'NUMERIQUE',
    intitule: 'Communications et supports numériques',
    attendu: [
      'Régularité des réquisitions (téléphonie, données de connexion)',
      "Traçabilité et intégrité de l'exploitation des appareils",
      'Accès de la défense aux éléments techniques BRUTS, pas seulement aux synthèses',
    ],
    evaluer(ctx) {
      const auto = griefAutorisation(ctx, /r[eé]quisition|t[eé]l[eé]phon|num[eé]rique|messagerie|d[eé]verrouillage|extraction/i, "l'obtention des données numériques");
      const preuvesNum = ctx.dossier.preuves.filter((p) => /t[eé]l[eé]phon|num[eé]rique|messagerie|born/i.test(p.type));
      const manques = [...auto.manques];
      for (const p of preuvesNum) {
        manques.push(
          manque(
            `Éléments techniques bruts de « ${p.type} » (${p.id})`,
            'le contrôle contradictoire de l’exploitation numérique',
            'Demander les données brutes et la méthodologie d’extraction, pas seulement le rapport de synthèse.',
            'important'
          )
        );
      }
      const constat = auto.recenses === 0 && preuvesNum.length === 0
        ? 'Aucune exploitation numérique recensée. Si le dossier en révèle (réquisitions téléphoniques, extraction d’appareils), la saisir comme acte ou élément de preuve.'
        : undefined;
      return { present: auto.present, manques, griefs: auto.griefs, constat };
    },
  },
  {
    numero: 9,
    id: 'TECHNIQUES-SPECIALES',
    intitule: "Techniques spéciales d'enquête",
    attendu: [
      'Autorisation et motivation (infiltration, livraison surveillée, achat surveillé)',
      "Absence de provocation à l'infraction — loyauté de la preuve",
    ],
    evaluer(ctx) {
      const auto = griefAutorisation(ctx, /infiltration|livraison surveill|achat surveill|coup d'achat/i, 'la loyauté de la preuve');
      const griefs = [...auto.griefs];
      for (const acte of actesDeType(ctx.dossier, /infiltration|achat surveill|coup d'achat/i)) {
        griefs.push({
          enonce: `« ${acte.type} » (${acte.id}) : vérifier si l'initiative de l'infraction vient des enquêteurs — une provocation à l'infraction, distincte de la provocation à la preuve, vicierait les poursuites.`,
          appuis: [acte.id, ...acte.cotes],
          actesAffectes: acte.actesSubsequents,
        });
      }
      const constat = auto.recenses === 0
        ? "Aucune technique spéciale recensée. Si une infiltration ou une livraison surveillée apparaît au dossier, la saisir comme acte : c'est un terrain de contrôle prioritaire."
        : undefined;
      return { present: auto.present, manques: auto.manques, griefs, constat };
    },
  },
  {
    numero: 10,
    id: 'FINANCIER',
    intitule: 'Volet financier et patrimonial',
    attendu: [
      'Régularité des saisies pénales',
      "Périmètre de l'enquête patrimoniale",
      'Justification de ressources : ce qui est réellement démontré',
    ],
    evaluer(ctx) {
      const auto = griefAutorisation(ctx, /saisie p[eé]nale|patrimoni|avoir|compte bancaire/i, 'la régularité de la saisie pénale');
      const constat = auto.recenses === 0
        ? 'Aucun acte patrimonial recensé. Si des saisies pénales ou une enquête patrimoniale figurent au dossier, les saisir comme actes.'
        : undefined;
      return { ...auto, constat };
    },
  },
  {
    numero: 11,
    id: 'EXPERTISES',
    intitule: 'Expertises et analyses',
    attendu: [
      "Désignation de l'expert et mission",
      'Respect du contradictoire',
      "Méthode, incertitude de mesure, traçabilité des échantillons",
    ],
    evaluer(ctx) {
      const expertises = ctx.dossier.pieces.filter((p) => p.nature === 'expertise');
      const present: ElementPresent[] = [];
      const manques: Manque[] = [];
      for (const e of expertises) {
        present.push({ element: `Expertise versée : « ${e.intitule} ».`, appuis: [e.id] });
        manques.push(
          manque(
            `Méthode et incertitude de « ${e.intitule} » (${e.id})`,
            'la contestation au fond de l’expertise',
            'Vérifier la mission, la méthode, la marge d’incertitude et la traçabilité des échantillons ; demander les pièces de travail.',
            'utile'
          )
        );
      }
      const constat = expertises.length === 0
        ? 'Aucune expertise versée dans les pièces saisies. Dans un contentieux de stupéfiants, l’analyse du produit et son grammage exact sont presque toujours déterminants : vérifier leur présence au dossier.'
        : undefined;
      return { present, manques, griefs: [], constat };
    },
  },
  {
    numero: 12,
    id: 'INSTRUCTION',
    intitule: 'Information judiciaire',
    attendu: [
      'Régularité de la mise en examen (indices graves ou concordants)',
      'Avis et notifications aux parties',
      "Demandes d'actes et délais de réponse",
    ],
    evaluer(ctx) {
      if (ctx.dossier.phase !== 'instruction') {
        return {
          present: [],
          manques: [],
          griefs: [],
          constat: `Le dossier n'est pas à l'instruction (phase : ${ctx.dossier.phase}). Poste sans objet à ce stade — il se rouvrira si la phase change.`,
        };
      }
      const auto = griefAutorisation(ctx, /mise en examen|interrogatoire de premi|avis de fin/i, "la régularité de l'information");
      const manques = [...auto.manques];
      if (auto.recenses === 0) {
        manques.push(
          manque(
            "Actes de l'information non saisis (mise en examen, interrogatoires, avis)",
            'tout contrôle du poste 12',
            "Saisir les actes de l'information avec leurs dates : la régularité de la mise en examen se contrôle pièce en main.",
            'bloquant'
          )
        );
      }
      return { present: auto.present, manques, griefs: auto.griefs };
    },
  },
  {
    numero: 13,
    id: 'DETENTION',
    intitule: 'Détention provisoire',
    attendu: [
      'Motivation de la détention au regard des critères légaux',
      'Débat contradictoire et assistance effective',
      'Prolongations dans les délais, délais butoirs surveillés',
    ],
    evaluer(ctx) {
      if (ctx.dossier.statutLiberte !== 'detention-provisoire') {
        return {
          present: [],
          manques: [],
          griefs: [],
          constat: `Le client n'est pas en détention provisoire (statut : ${ctx.dossier.statutLiberte}). Poste sans objet à ce stade.`,
        };
      }
      const echeancesDetention = ctx.dossier.echeances.filter((e) => e.type === 'detention');
      const manques: Manque[] = [];
      const present: ElementPresent[] = [];
      if (echeancesDetention.length === 0) {
        manques.push(
          manque(
            'Aucune échéance de détention saisie',
            'la surveillance des délais butoirs — le manquement le plus coûteux du contentieux',
            'Calculer et saisir le terme de chaque titre de détention et de chaque prolongation.',
            'bloquant'
          )
        );
      } else {
        for (const e of echeancesDetention) {
          present.push({ element: `Échéance de détention suivie : ${e.intitule} (${e.date}).`, appuis: [e.id] });
        }
      }
      return { present, manques, griefs: [] };
    },
  },
  {
    numero: 14,
    id: 'RECEVABILITE',
    intitule: 'Recevabilité du grief',
    attendu: [
      'Qualité et intérêt à agir pour chaque grief',
      'Absence de forclusion, purge éventuelle des nullités',
    ],
    evaluer(ctx) {
      const present: ElementPresent[] = [];
      const manques: Manque[] = [];
      const griefs: GriefEnvisage[] = [];

      for (const grief of ctx.dossier.griefs) {
        if (grief.interetAAgir.trim()) {
          present.push({ element: `Grief ${grief.id} : intérêt à agir articulé (${grief.interetAAgir}).`, appuis: [grief.id, grief.acteViseId] });
        } else {
          manques.push(
            manque(
              `Intérêt à agir du grief ${grief.id} non articulé`,
              'la recevabilité du moyen de nullité correspondant',
              "Articuler en quoi l'irrégularité a porté atteinte aux intérêts du client — sans quoi le moyen sera déclaré irrecevable.",
              'bloquant'
            )
          );
        }
        if (grief.forclusionEventuelle === null) {
          manques.push(
            manque(
              `Forclusion du grief ${grief.id} non examinée`,
              'le choix du moment pour soulever le moyen',
              'Vérifier le délai de forclusion applicable au stade de la procédure et la purge éventuelle.',
              'important'
            )
          );
        }
      }
      const constat = ctx.dossier.griefs.length === 0
        ? 'Aucun grief formalisé à ce stade : la recevabilité se contrôlera grief par grief, dès le premier.'
        : undefined;
      return { present, manques, griefs, constat };
    },
  },
];

// ---------------------------------------------------------------------------
// Entrée du module
// ---------------------------------------------------------------------------

/**
 * Passe la grille complète. Les QUATORZE postes sortent toujours, dans
 * l'ordre — un test le verrouille.
 */
export function grilleRegularite(
  dossier: DossierPenal,
  analyse: AnalyseDossier,
  nullites: RapportNullites
): PosteRegularite[] {
  const ctx: Contexte = { dossier, analyse, nullites };

  return DEFINITIONS.map((def) => {
    const resultat = def.evaluer(ctx);

    // Complète les actes affectés par propagation quand le grief vise un acte.
    const griefs = resultat.griefs.map((g) => ({
      ...g,
      actesAffectes: [...new Set([
        ...g.actesAffectes,
        ...g.appuis
          .filter((id) => dossier.actes.some((a) => a.id === id))
          .flatMap((id) => actesContamines(dossier, { id: 'tmp', acteViseId: id, irregularite: '', interetAAgir: '', cotesAffectees: [], actesSubsequentsContamines: [], forclusionEventuelle: null, appuis: [] })
            .filter((x) => x !== id)),
      ])],
    }));

    const synthese: PosteRegularite['synthese'] =
      griefs.length > 0 ? 'grief' : resultat.manques.length > 0 ? 'manque' : 'constat';

    const constat =
      resultat.constat ??
      (synthese === 'grief'
        ? `${griefs.length} grief(s) envisageable(s) sur ce poste.`
        : synthese === 'manque'
          ? `${resultat.manques.length} élément(s) manquant(s) — le poste n'est pas contrôlable en l'état.`
          : `${resultat.present.length} élément(s) contrôlé(s), rien à signaler sur les éléments saisis.`);

    return {
      numero: def.numero,
      id: def.id,
      intitule: def.intitule,
      attendu: def.attendu,
      present: resultat.present,
      manques: resultat.manques,
      griefs,
      synthese,
      constat,
    };
  });
}

/** La grille comme passe P2, avec sa déclaration complète. */
export function executerP2(
  dossier: DossierPenal,
  analyse: AnalyseDossier,
  nullites: RapportNullites,
  horodatage?: string
): { postes: PosteRegularite[]; sortie: SortiePasse } {
  const postes = grilleRegularite(dossier, analyse, nullites);

  const sortie = scellerSortie(
    'P2',
    dossier,
    postes.flatMap((poste) => [
      ...poste.present.map((p) => ({ enonce: `[${poste.id}] ${p.element}`, appuis: p.appuis })),
      ...poste.griefs.map((g) => ({ enonce: `[${poste.id}] GRIEF — ${g.enonce}`, appuis: g.appuis })),
    ]),
    {
      moteur: MOTEUR_DETERMINISTE,
      traite: postes.map((p) => `poste-${p.numero}-${p.id}`),
      manques: postes.flatMap((p) => p.manques.map((m) => ({ quoi: m.nature, necessairePour: m.necessairePour, action: m.action }))),
      ouvert: postes.filter((p) => p.synthese === 'manque').map((p) => `Poste ${p.numero} (${p.intitule}) : non contrôlable en l'état.`),
      horodatage,
    }
  );

  return { postes, sortie };
}
