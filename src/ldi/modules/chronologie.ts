/**
 * LDI — Module 1 : analyse de dossier.
 *
 * Reconstruit la chronologie et cherche les incohérences que l'œil fatigue à
 * voir : une audition qui précède la notification des droits, un procès-verbal
 * daté avant l'événement qu'il constate, une personne présente à deux endroits.
 *
 * Le module ne conclut jamais à une nullité — il produit des constats factuels
 * et renvoie au module 3 pour la qualification juridique. Chaque contradiction
 * porte la vérification à opérer au dossier, parce qu'une incohérence
 * apparente est souvent une erreur de saisie plutôt qu'une irrégularité.
 */
import { DUREE_MAX_GAV_HEURES } from '../corpus/references';
import type {
  AnalyseDossier,
  Contradiction,
  Dossier,
  Evenement,
  RegimeProcedural,
} from '../types';

/**
 * Seuils de déclenchement. Ce sont des seuils de TRI, pas des règles de droit :
 * ils décident de ce qui est signalé à l'avocat, jamais de ce qui est
 * irrégulier. Seul l'art. 63-4-2 CPP fixe lui-même un délai (deux heures).
 */
export const SEUILS = {
  /** Au-delà, le délai entre privation de liberté et notification des droits est signalé. */
  notificationDroitsMinutes: 30,
  /** Délai légal de l'art. 63-4-2 CPP avant première audition sans avocat. */
  carenceAvocatMinutes: 120,
} as const;

const MOTIF_IDENTITE = /identit[ée]/i;

type Instant = { minutes: number; avecHeure: boolean };

/**
 * Parse un horodatage ISO-8601 en minutes depuis l'époque, en UTC.
 * L'analyse est faite à la main plutôt que via `new Date(...)` pour que le
 * résultat ne dépende pas du fuseau de la machine qui exécute le rapport.
 */
export function parseHorodatage(valeur: string): Instant | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(valeur.trim());
  if (!m) return null;

  const [, y, mo, d, h, mi] = m;
  const annee = Number(y);
  const mois = Number(mo);
  const jour = Number(d);
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31) return null;

  const avecHeure = h !== undefined && mi !== undefined;
  const heures = avecHeure ? Number(h) : 0;
  const minutes = avecHeure ? Number(mi) : 0;
  if (heures > 23 || minutes > 59) return null;

  const ms = Date.UTC(annee, mois - 1, jour, heures, minutes);
  if (Number.isNaN(ms)) return null;

  // Date.UTC ne signale pas les dates impossibles : elle les reporte
  // silencieusement (« 2026-02-30 » devient le 2 mars). L'événement resterait
  // dans la chronologie à un instant qui n'est pas celui du document, et tous
  // les calculs de durée porteraient sur cette date décalée. Aller-retour de
  // contrôle : ce qui ne revient pas identique est illisible, pas corrigeable.
  const controle = new Date(ms);
  if (
    controle.getUTCFullYear() !== annee ||
    controle.getUTCMonth() !== mois - 1 ||
    controle.getUTCDate() !== jour
  ) {
    return null;
  }

  return { minutes: Math.floor(ms / 60_000), avecHeure };
}

function instantDe(e: Evenement): Instant | null {
  return parseHorodatage(e.horodatage);
}

/** Trie les événements par horodatage. Les horodatages illisibles ferment la marche. */
/**
 * Départage deux identifiants par point de code. `localeCompare` dépend de la
 * locale : deux exécutions du même dossier pouvaient ordonner différemment
 * deux événements non datés, et l'empreinte du dossier avec elles.
 */
function comparerIdentifiants(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function trierChronologie(evenements: Evenement[]): Evenement[] {
  return [...evenements].sort((a, b) => {
    const ia = instantDe(a);
    const ib = instantDe(b);
    if (!ia && !ib) return comparerIdentifiants(a.id, b.id);
    if (!ia) return 1;
    if (!ib) return -1;
    if (ia.minutes !== ib.minutes) return ia.minutes - ib.minutes;
    return comparerIdentifiants(a.id, b.id);
  });
}

function heures(minutes: number): string {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

function premier(evenements: Evenement[], nature: Evenement['nature']): Evenement | undefined {
  return evenements.find((e) => e.nature === nature);
}

// ---------------------------------------------------------------------------
// Détecteurs
// ---------------------------------------------------------------------------

/** Horodatages absents ou illisibles : rien ne peut être contrôlé sans eux. */
function detecterHorodatagesInvalides(evenements: Evenement[]): Contradiction[] {
  return evenements
    .filter((e) => instantDe(e) === null)
    .map<Contradiction>((e) => ({
      type: 'chronologie',
      severite: 'majeure',
      constat: `L'événement « ${e.description} » porte un horodatage illisible (« ${e.horodatage} »).`,
      elements: [e.id],
      verificationSuggeree:
        "Relever l'heure exacte portée sur la pièce d'origine. Un horodatage absent du procès-verbal est en soi une mention manquante à relever.",
    }));
}

/** Un procès-verbal ne peut pas constater un événement postérieur à sa propre date. */
function detecterAnterioritePiece(dossier: Dossier): Contradiction[] {
  const parId = new Map(dossier.pieces.map((p) => [p.id, p]));
  const out: Contradiction[] = [];

  for (const e of dossier.evenements) {
    if (!e.sourcePieceId) continue;
    const piece = parId.get(e.sourcePieceId);
    if (!piece?.date) continue;

    const iEvt = instantDe(e);
    const iPiece = parseHorodatage(piece.date);
    if (!iEvt || !iPiece) continue;

    // Comparaison à la journée près quand la pièce n'est datée que du jour.
    const marge = iPiece.avecHeure ? 0 : 24 * 60;
    if (iEvt.minutes > iPiece.minutes + marge) {
      out.push({
        type: 'anteriorite-piece',
        severite: 'critique',
        constat: `La pièce ${piece.cote ?? piece.id} (${piece.date}) est datée avant l'événement qu'elle est censée établir : « ${e.description} » (${e.horodatage}).`,
        elements: [e.id, piece.id],
        verificationSuggeree:
          "Confronter la date de rédaction du procès-verbal et l'heure des faits qu'il relate. Vérifier s'il s'agit d'une erreur matérielle rectifiable ou d'un acte reconstitué a posteriori.",
      });
    }
  }
  return out;
}

/** Une même personne ne peut pas être à deux endroits au même moment. */
function detecterPresenceSimultanee(evenements: Evenement[]): Contradiction[] {
  const out: Contradiction[] = [];
  const datables = evenements.filter((e) => e.personne && e.lieu && instantDe(e)?.avecHeure);

  for (let i = 0; i < datables.length; i += 1) {
    for (let j = i + 1; j < datables.length; j += 1) {
      const a = datables[i];
      const b = datables[j];
      if (a.personne !== b.personne) continue;
      if (a.lieu === b.lieu) continue;

      const ia = instantDe(a);
      const ib = instantDe(b);
      if (!ia || !ib) continue;

      const finA = ia.minutes + (a.dureeMinutes ?? 0);
      const finB = ib.minutes + (b.dureeMinutes ?? 0);
      const chevauche = ia.minutes < finB && ib.minutes < finA;
      const memeInstant = ia.minutes === ib.minutes;

      if (chevauche || memeInstant) {
        out.push({
          type: 'presence-simultanee',
          severite: 'critique',
          constat: `${a.personne} est déclarée simultanément à « ${a.lieu} » (${a.horodatage}) et à « ${b.lieu} » (${b.horodatage}).`,
          elements: [a.id, b.id],
          verificationSuggeree:
            'Comparer les deux pièces sources et les heures qu’elles portent. Contradiction exploitable si elle est confirmée par les originaux.',
        });
      }
    }
  }
  return out;
}

/** Durée de garde à vue confrontée au régime applicable et aux prolongations actées. */
function detecterDureeGardeAVue(
  evenements: Evenement[],
  regime: RegimeProcedural
): Contradiction[] {
  const out: Contradiction[] = [];
  const debut = premier(evenements, 'debut-garde-a-vue');
  if (!debut) return out;

  const iDebut = instantDe(debut);
  if (!iDebut?.avecHeure) return out;

  const prolongations = evenements.filter((e) => e.nature === 'prolongation-garde-a-vue');
  const fin =
    premier(evenements, 'fin-garde-a-vue') ?? premier(evenements, 'presentation-magistrat');

  // Nombre de prolongations que le régime autorise, DÉDUIT du plafond horaire du
  // corpus : dupliquer la limite ici, c'est prendre le risque que ce module
  // constate un dépassement au regard d'un plafond et que le module 3 en
  // annonce un autre.
  const plafondHeures = DUREE_MAX_GAV_HEURES[regime]?.heures ?? 48;
  const maxProlongations = Math.max(0, Math.round(plafondHeures / 24) - 1);
  if (prolongations.length > maxProlongations) {
    out.push({
      type: 'duree-legale',
      severite: 'critique',
      constat: `${prolongations.length} prolongations sont actées alors que le régime « ${regime} » n'en autorise que ${maxProlongations}.`,
      elements: prolongations.map((p) => p.id),
      verificationSuggeree:
        "Vérifier le fondement de chaque prolongation et l'autorité qui l'a décidée (procureur, JLD ou juge d'instruction selon le régime).",
    });
  }

  const autoriseeHeures = 24 * (1 + Math.min(prolongations.length, maxProlongations));

  if (fin) {
    const iFin = instantDe(fin);
    if (iFin?.avecHeure) {
      const ecoule = iFin.minutes - iDebut.minutes;

      if (ecoule < 0) {
        out.push({
          type: 'chronologie',
          severite: 'critique',
          constat: `La fin de garde à vue (${fin.horodatage}) précède son début (${debut.horodatage}).`,
          elements: [debut.id, fin.id],
          verificationSuggeree: 'Relever les heures portées au registre de garde à vue et au procès-verbal de fin de mesure.',
        });
      } else if (ecoule > autoriseeHeures * 60) {
        out.push({
          type: 'duree-legale',
          severite: 'critique',
          constat: `La garde à vue a duré ${heures(ecoule)}, soit au-delà des ${autoriseeHeures} h couvertes par la mesure initiale et les ${prolongations.length} prolongation(s) actée(s).`,
          elements: [debut.id, fin.id, ...prolongations.map((p) => p.id)],
          verificationSuggeree:
            "Rechercher au dossier l'autorisation écrite et motivée de prolongation. Vérifier également l'heure retenue comme point de départ : elle court depuis la privation de liberté effective, pas depuis le placement formel (art. 63 CPP).",
        });
      }
    }
  }

  // Prolongation décidée avant le début de la mesure, ou avant l'échéance qu'elle prolonge.
  for (const p of prolongations) {
    const iP = instantDe(p);
    if (!iP?.avecHeure) continue;
    if (iP.minutes < iDebut.minutes) {
      out.push({
        type: 'chronologie',
        severite: 'critique',
        constat: `Une prolongation est datée du ${p.horodatage}, soit avant le début de la garde à vue (${debut.horodatage}).`,
        elements: [debut.id, p.id],
        verificationSuggeree: "Vérifier la date et l'heure de la décision de prolongation et son versement au dossier.",
      });
    }
  }

  return out;
}

/** Ordre des actes : droits notifiés avant audition, délai avocat respecté. */
function detecterSequenceProcedurale(evenements: Evenement[]): Contradiction[] {
  const out: Contradiction[] = [];
  const debut = premier(evenements, 'debut-garde-a-vue');
  const notification = premier(evenements, 'notification-droits');
  const auditions = evenements.filter((e) => e.nature === 'audition' || e.nature === 'confrontation');
  const premiereAudition = auditions[0];

  // 1. Notification des droits tardive au regard du début de la mesure.
  if (debut && notification) {
    const iDebut = instantDe(debut);
    const iNotif = instantDe(notification);
    if (iDebut?.avecHeure && iNotif?.avecHeure) {
      const ecart = iNotif.minutes - iDebut.minutes;
      if (ecart < 0) {
        out.push({
          type: 'sequence-procedurale',
          severite: 'majeure',
          constat: `Les droits sont notifiés (${notification.horodatage}) avant le placement en garde à vue (${debut.horodatage}).`,
          elements: [debut.id, notification.id],
          verificationSuggeree:
            "Vérifier l'heure de la privation de liberté effective : si elle est antérieure au placement acté, c'est elle qui fait courir la mesure.",
        });
      } else if (ecart > SEUILS.notificationDroitsMinutes) {
        out.push({
          type: 'sequence-procedurale',
          severite: 'majeure',
          constat: `${heures(ecart)} séparent le placement en garde à vue de la notification des droits.`,
          elements: [debut.id, notification.id],
          verificationSuggeree:
            "L'art. 63-1 CPP impose une notification immédiate. Rechercher au dossier la circonstance insurmontable invoquée pour justifier le délai ; à défaut, le retard est exploitable.",
        });
      }
    }
  }

  // 2. Audition antérieure à la notification des droits.
  if (premiereAudition && notification) {
    const iAudition = instantDe(premiereAudition);
    const iNotif = instantDe(notification);
    if (iAudition && iNotif && iAudition.minutes < iNotif.minutes) {
      out.push({
        type: 'sequence-procedurale',
        severite: 'critique',
        constat: `Une audition débute le ${premiereAudition.horodatage}, avant la notification des droits (${notification.horodatage}).`,
        elements: [premiereAudition.id, notification.id],
        verificationSuggeree:
          "Confronter les heures d'ouverture de l'audition et de la notification portées aux procès-verbaux respectifs.",
      });
    }
  }

  // 3. Aucune notification alors que la mesure est actée.
  if (debut && !notification) {
    out.push({
      type: 'sequence-procedurale',
      severite: 'critique',
      constat: "Aucun événement de notification des droits n'apparaît dans la chronologie de la garde à vue.",
      elements: [debut.id],
      verificationSuggeree:
        "Réclamer le procès-verbal de notification des droits. Son absence au dossier, si elle est confirmée, est le grief le plus direct.",
    });
  }

  // 4. Délai de deux heures de l'art. 63-4-2 CPP.
  const avis = premier(evenements, 'avis-avocat') ?? premier(evenements, 'demande-avocat');
  if (avis && premiereAudition && !MOTIF_IDENTITE.test(premiereAudition.description)) {
    const iAvis = instantDe(avis);
    const iAudition = instantDe(premiereAudition);
    const arrivee = premier(evenements, 'arrivee-avocat') ?? premier(evenements, 'entretien-avocat');
    const iArrivee = arrivee ? instantDe(arrivee) : null;

    const avocatPresent =
      iArrivee !== null && iAudition !== null && iArrivee.minutes <= iAudition.minutes;

    if (iAvis?.avecHeure && iAudition?.avecHeure && !avocatPresent) {
      const ecart = iAudition.minutes - iAvis.minutes;
      if (ecart < SEUILS.carenceAvocatMinutes) {
        // Un écart négatif signifie que l'audition a précédé l'avis : le dire
        // « après » inverserait le fait, dans un constat que le module 3 et la
        // requête en nullité reprennent mot pour mot.
        const constat =
          ecart < 0
            ? `La première audition débute le ${premiereAudition.horodatage}, soit ${heures(ecart)} AVANT l'avis à avocat (${avis.horodatage}), hors présence de l'avocat.`
            : `La première audition débute ${heures(ecart)} après l'avis à avocat, hors sa présence, alors que l'art. 63-4-2 CPP impose d'attendre deux heures.`;
        out.push({
          type: 'sequence-procedurale',
          regle: 'carence-avocat-63-4-2',
          severite: 'critique',
          constat,
          elements: [avis.id, premiereAudition.id],
          verificationSuggeree:
            "Vérifier si une décision de report de l'intervention de l'avocat figure au dossier, par quelle autorité et sur quel motif. À défaut, le grief est caractérisé.",
        });
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Entrée du module
// ---------------------------------------------------------------------------

export function analyserDossier(dossier: Dossier): AnalyseDossier {
  const regime = dossier.regime ?? 'droit-commun';
  const chronologie = trierChronologie(dossier.evenements);

  const contradictions: Contradiction[] = [
    ...detecterHorodatagesInvalides(chronologie),
    ...detecterAnterioritePiece(dossier),
    ...detecterPresenceSimultanee(chronologie),
    ...detecterDureeGardeAVue(chronologie, regime),
    ...detecterSequenceProcedurale(chronologie),
  ];

  const rang: Record<Contradiction['severite'], number> = { critique: 0, majeure: 1, mineure: 2 };
  contradictions.sort((a, b) => rang[a.severite] - rang[b.severite]);

  const piecesCitees = new Set(
    dossier.evenements.map((e) => e.sourcePieceId).filter((id): id is string => Boolean(id))
  );

  return {
    reference: dossier.reference,
    qualifications: dossier.qualifications,
    regime,
    chronologie,
    contradictions,
    piecesTotal: dossier.pieces.length,
    evenementsNonSources: chronologie.filter((e) => !e.sourcePieceId).map((e) => e.id),
    piecesOrphelines: dossier.pieces.filter((p) => !piecesCitees.has(p.id)).map((p) => p.id),
  };
}
