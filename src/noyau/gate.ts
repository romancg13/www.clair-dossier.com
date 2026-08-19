/**
 * DEFENSE OS — M9, la gate d'export (§10.2).
 *
 * ┌─ POURQUOI CE MODULE EST CONSTRUIT AVANT LES GÉNÉRATEURS ────────────────┐
 * │ Un générateur écrit ce qu'on lui permet d'écrire. Construire d'abord le  │
 * │ contrôle, c'est s'interdire de livrer un jour un générateur dont les     │
 * │ sorties n'ont jamais été passées au crible.                              │
 * │                                                                          │
 * │ Le blocage rend le CHEMIN EXACT de l'anomalie — pas « export refusé »,   │
 * │ mais « moyens[2].ripostePrevue est vide ». Un blocage qu'on ne peut pas  │
 * │ localiser est un blocage qu'on contourne.                                │
 * │                                                                          │
 * │ Il n'existe AUCUNE option d'interface qui passe outre : la seule issue   │
 * │ est de corriger ce qui est nommé.                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Honnêteté sur les détecteurs textuels : les motifs B13/B15 sont des fils de
 * détente lexicaux, pas une compréhension. Ils attrapent les formulations
 * franches ; le premier rempart reste les instructions de passe et le refus à
 * la génération. Le détecteur de pronostic, lui, est volontairement large :
 * TOUT pourcentage bloque (B4 dit « aucun pourcentage »), quitte à demander à
 * l'avocat de reformuler une citation — décision consignée au registre.
 */
import type { Contradiction } from '../ldi/types';
import type { DossierPenal, Moyen } from './modele';
import type { SortiePasse } from './passes';

export type AnomalieExport = {
  /** Où, exactement : `moyens[1].ripostePrevue`, `corps (ligne 12)`… */
  chemin: string;
  /** La règle du mandat qui bloque. */
  regle: string;
  detail: string;
};

export type VerdictExport = {
  autorise: boolean;
  anomalies: AnomalieExport[];
};

/** Référence affichable : les cinq métadonnées de B3, toutes présentes. */
export type ReferenceAffichee = {
  identifiant: string;
  date: string;
  source: string;
  url: string;
  recupereLe: string;
};

export function referenceComplete(r: Partial<ReferenceAffichee>): boolean {
  return Boolean(
    r.identifiant?.trim() && r.date?.trim() && r.source?.trim() && r.url?.trim() && r.recupereLe?.trim()
  );
}

// ---------------------------------------------------------------------------
// Détecteurs textuels
// ---------------------------------------------------------------------------

const MOTIFS_PRONOSTIC: { motif: RegExp; nom: string }[] = [
  { motif: /\d+\s*%/u, nom: 'pourcentage' },
  { motif: /\bchances?\s+de\s+(succ[eè]s|relaxe|nullit[eé]|gagner)/iu, nom: 'chances de' },
  { motif: /\bprobabilit[eé]s?\s+(de|d['’])/iu, nom: 'probabilité de' },
  { motif: /\bpronostic\s+(de|sur|chiffr[eé])/iu, nom: 'pronostic' },
  { motif: /\bvous\s+serez\s+(relax[eé]|acquitt[eé]|condamn[eé])/iu, nom: 'prédiction de décision' },
];

const MOTIFS_CULPABILITE: RegExp[] = [
  /\b(le\s+client|la\s+cliente|il|elle)\s+est\s+(coupable|innocent[e]?)\b/iu,
  /\bculpabilit[eé]\s+(est\s+)?[eé]tablie\b/iu,
  /\best\s+(bien\s+)?l['’]auteur\s+des\s+faits\b/iu,
];

const MOTIFS_B13: RegExp[] = [
  /\b(dissimuler|d[eé]truire|alt[eé]rer|faire\s+dispara[iî]tre)\b[^.]{0,60}\b(preuve|pi[eè]ce|scell[eé]|t[eé]l[eé]phone|support)/iu,
  /\b(faire\s+pression|influencer|contacter[^.]{0,40}pour\s+qu)\b[^.]{0,60}\b(t[eé]moin|co[- ]?mis\s+en\s+cause|expert)/iu,
  /\bse\s+soustraire\s+aux?\s+(recherches|mandat|mesure|ex[eé]cution)/iu,
];

function lignesEnFaute(texte: string, motifs: { motif: RegExp; nom: string }[]): { ligne: number; nom: string; extrait: string }[] {
  const fautes: { ligne: number; nom: string; extrait: string }[] = [];
  const lignes = texte.split('\n');
  for (const [i, ligne] of lignes.entries()) {
    for (const { motif, nom } of motifs) {
      const m = motif.exec(ligne);
      if (m) fautes.push({ ligne: i + 1, nom, extrait: ligne.trim().slice(0, 90) });
    }
  }
  return fautes;
}

// ---------------------------------------------------------------------------
// La gate
// ---------------------------------------------------------------------------

export type LivrableAExporter = {
  /** Nom du livrable, pour le chemin des anomalies. */
  nom: string;
  corps: string;
  /** Moyens portés par le livrable, s'il en porte. */
  moyens?: Moyen[];
  /** Références affichées dans le corps, avec leurs métadonnées. */
  references?: Partial<ReferenceAffichee>[];
  /** Sorties de passes dont le livrable est issu. */
  sorties?: SortiePasse[];
  /** Contradictions relevées par l'analyse du dossier. */
  contradictions?: Contradiction[];
};

const MENTION_FONDEMENT = 'fondement à vérifier auprès de la source officielle';

export function controlerExport(livrable: LivrableAExporter, dossier: DossierPenal): VerdictExport {
  const anomalies: AnomalieExport[] = [];
  const cotesConnues = new Set(dossier.pieces.flatMap((p) => [p.id, ...(p.cote ? [p.cote] : [])]));
  const faitsEtActes = new Set([...dossier.faits.map((f) => f.id), ...dossier.actes.map((a) => a.id)]);

  // ── B4 : aucun chiffre de pronostic ──────────────────────────────────────
  for (const faute of lignesEnFaute(livrable.corps, MOTIFS_PRONOSTIC)) {
    anomalies.push({
      chemin: `${livrable.nom} · corps (ligne ${faute.ligne})`,
      regle: 'B4 — aucun pourcentage, aucune probabilité, aucun pronostic',
      detail: `Motif « ${faute.nom} » : « ${faute.extrait} »`,
    });
  }

  // ── B15 : aucune affirmation de culpabilité ou d'innocence ───────────────
  for (const faute of lignesEnFaute(livrable.corps, MOTIFS_CULPABILITE.map((m) => ({ motif: m, nom: 'culpabilité' })))) {
    anomalies.push({
      chemin: `${livrable.nom} · corps (ligne ${faute.ligne})`,
      regle: 'B15 — aucune affirmation sur la culpabilité ou l’innocence',
      detail: `« ${faute.extrait} »`,
    });
  }

  // ── B13 : fil de détente sur les contenus interdits ──────────────────────
  for (const faute of lignesEnFaute(livrable.corps, MOTIFS_B13.map((m) => ({ motif: m, nom: 'B13' })))) {
    anomalies.push({
      chemin: `${livrable.nom} · corps (ligne ${faute.ligne})`,
      regle: 'B13 — périmètre déontologique',
      detail: `« ${faute.extrait} »`,
    });
  }

  // ── B3 : toute référence affichée porte ses cinq métadonnées ─────────────
  for (const [i, ref] of (livrable.references ?? []).entries()) {
    if (!referenceComplete(ref)) {
      anomalies.push({
        chemin: `${livrable.nom} · references[${i}]`,
        regle: 'B3 — métadonnées incomplètes ⇒ non affichable',
        detail: `« ${ref.identifiant ?? '(sans identifiant)'} » : il manque ${[
          !ref.identifiant?.trim() && 'identifiant',
          !ref.date?.trim() && 'date',
          !ref.source?.trim() && 'source',
          !ref.url?.trim() && 'URL officielle',
          !ref.recupereLe?.trim() && 'horodatage de récupération',
        ]
          .filter(Boolean)
          .join(', ')}.`,
      });
    }
  }

  // ── Moyens : riposte anticipée (P5) + appuis résolubles ──────────────────
  for (const [i, moyen] of (livrable.moyens ?? []).entries()) {
    if (!moyen.ripostePrevue.trim() || !moyen.contreRiposte.trim()) {
      anomalies.push({
        chemin: `${livrable.nom} · moyens[${i}] (${moyen.id})`,
        regle: 'P5 — un moyen sans riposte anticipée est incomplet',
        detail: !moyen.ripostePrevue.trim()
          ? 'La riposte prévisible du parquet n’est pas renseignée.'
          : 'La contre-riposte n’est pas renseignée.',
      });
    }
    for (const appui of moyen.appuis) {
      if (!cotesConnues.has(appui) && !faitsEtActes.has(appui)) {
        anomalies.push({
          chemin: `${livrable.nom} · moyens[${i}].appuis`,
          regle: 'Gate — moyen citant une cote inexistante',
          detail: `« ${appui} » n’existe pas au dossier ${dossier.reference}.`,
        });
      }
    }
    if (moyen.references.length === 0 && !livrable.corps.toLowerCase().includes(MENTION_FONDEMENT)) {
      anomalies.push({
        chemin: `${livrable.nom} · moyens[${i}].references`,
        regle: '§9.1 — un moyen sans source porte la mention imposée',
        detail: `Le moyen ${moyen.id} n’a aucune référence résolue et le corps ne porte pas « ${MENTION_FONDEMENT} ».`,
      });
    }
  }

  // ── Ancrage : aucune sortie de passe avec un énoncé non ancré ────────────
  for (const sortie of livrable.sorties ?? []) {
    for (const [i, r] of sortie.resultats.entries()) {
      if (r.ancrage === 'absent') {
        anomalies.push({
          chemin: `${livrable.nom} · ${sortie.passe}.resultats[${i}]`,
          regle: 'B16 — énoncé sans ancrage',
          detail: `« ${r.enonce.slice(0, 90)} »`,
        });
      }
    }
    // ── B19/D-3 : un envoi distant sans consentement enregistré bloque ─────
    if (sortie.moteur.type === 'distant' && !sortie.moteur.consentementDistant) {
      anomalies.push({
        chemin: `${livrable.nom} · ${sortie.passe}.moteur`,
        regle: 'B19 — consentement distant absent alors qu’un envoi a eu lieu',
        detail: 'La sortie déclare un moteur distant sans consentement par dossier.',
      });
    }
  }

  // ── Incohérences de date bloquantes ──────────────────────────────────────
  for (const [i, c] of (livrable.contradictions ?? []).entries()) {
    if (c.severite === 'critique') {
      anomalies.push({
        chemin: `${livrable.nom} · contradictions[${i}]`,
        regle: 'Gate — incohérence de date bloquante',
        detail: `${c.type} : ${c.constat.slice(0, 120)}`,
      });
    }
  }

  return { autorise: anomalies.length === 0, anomalies };
}

/**
 * Rendu du blocage pour l'écran et la CLI : chaque anomalie sur sa ligne,
 * chemin d'abord. Ce texte est le SEUL retour de la gate — il n'y a pas de
 * case « exporter quand même ».
 */
export function rendreVerdict(verdict: VerdictExport): string {
  if (verdict.autorise) return 'Export autorisé : aucune anomalie.';
  return [
    `Export bloqué — ${verdict.anomalies.length} anomalie(s) :`,
    ...verdict.anomalies.map((a) => `  ${a.chemin}\n    ${a.regle}\n    ${a.detail}`),
  ].join('\n');
}
