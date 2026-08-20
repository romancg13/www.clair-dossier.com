/**
 * DEFENSE OS — orchestrateur des sept passes (§3.2).
 *
 * ┌─ AUCUN LIVRABLE SANS LES SEPT PASSES, DANS L'ORDRE ─────────────────────┐
 * │ P0 (ingestion) s'exécute au dépôt des documents ; cette chaîne enchaîne  │
 * │ P1 → P6 sur l'état courant du dossier. Chaque passe scelle sa sortie ;   │
 * │ P6 recalcule l'ancrage de TOUTES les sorties indépendamment et rend le   │
 * │ verdict — une divergence bloque.                                         │
 * │                                                                          │
 * │ La chaîne entière est DÉTERMINISTE : elle tourne sans aucun modèle       │
 * │ (mode « déterministe seul », toujours disponible). Le moteur d'inférence │
 * │ n'intervient qu'en aval, sur demande, jamais dans cette chaîne.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import { analyserDossier } from '../ldi/modules/chronologie';
import { detecterIrregularites } from '../ldi/modules/nullites';
import { construireStrategie } from '../ldi/modules/strategie';
import type { AnalyseDossier, NoteStrategique, RapportNullites } from '../ldi/types';
import { creerJournalAudit, type JournalAudit } from './audit';
import { controlerInvariants, type DossierPenal, type Moyen, type Violation } from './modele';
import { executerP2, type PosteRegularite } from './postes';
import { executerP3, type AnalysePreuve } from './preuve';
import { executerP4, type AnalyseQualification } from './qualification';
import { construireMoyens, executerP5 } from './moyens';
import {
  MOTEUR_DETERMINISTE,
  scellerSortie,
  verifierAncrage,
  type SortiePasse,
} from './passes';

export type ResultatChaine = {
  dossier: DossierPenal;
  analyse: AnalyseDossier;
  nullites: RapportNullites;
  strategie: NoteStrategique;
  postes: PosteRegularite[];
  preuves: AnalysePreuve[];
  qualifications: AnalyseQualification[];
  moyens: Moyen[];
  moyensIncomplets: Moyen[];
  violations: Violation[];
  sorties: SortiePasse[];
  /** Verdict P6 : l'ancrage de chaque sortie, recalculé indépendamment. */
  verdictP6: { conforme: boolean; divergences: string[] };
  journal: JournalAudit;
};

/**
 * Déroule P1 → P6 sur le dossier. `maintenant` est injectable : la chaîne est
 * rejouable à l'identique, et un rejeu qui diffère signale une modification.
 */
export function executerChaine(
  dossier: DossierPenal,
  options: { maintenant?: string; journal?: JournalAudit } = {}
): ResultatChaine {
  const maintenant = options.maintenant ?? new Date().toISOString();
  const journal = options.journal ?? creerJournalAudit();
  const sorties: SortiePasse[] = [];

  // ── P1 — greffe : enregistrement et invariants, sans interprétation ─────
  const violations = controlerInvariants(dossier);
  const p1 = scellerSortie(
    'P1',
    dossier,
    [
      ...dossier.actes.map((a) => ({
        enonce: `Acte enregistré : ${a.type}${a.dateHeure ? ` (${a.dateHeure})` : ' [non daté]'}.`,
        appuis: [a.id],
      })),
      ...dossier.mesures.map((m) => ({
        enonce: `Mesure enregistrée : ${m.type}${m.debut ? `, du ${m.debut}` : ''}${m.fin ? ` au ${m.fin}` : ''}.`,
        appuis: [m.id],
      })),
    ],
    {
      moteur: MOTEUR_DETERMINISTE,
      traite: [
        ...dossier.pieces.map((p) => p.id),
        ...dossier.actes.map((a) => a.id),
        ...dossier.mesures.map((m) => m.id),
      ],
      manques: violations.map((v) => ({
        quoi: `${v.entite} ${v.id} : ${v.regle}`,
        necessairePour: "la fiabilité de tout ce qui s'appuie sur cette entité",
        action: 'Corriger la saisie ou compléter la cote manquante.',
      })),
      horodatage: maintenant,
    }
  );
  sorties.push(p1);
  journal.consignerPasse(p1);

  // ── P2 — contrôle : la grille des quatorze postes ────────────────────────
  const analyse = analyserDossier(dossier);
  const nullites = detecterIrregularites(dossier, analyse);
  const p2 = executerP2(dossier, analyse, nullites, maintenant);
  sorties.push(p2.sortie);
  journal.consignerPasse(p2.sortie);

  // ── P3 — preuve ──────────────────────────────────────────────────────────
  const p3 = executerP3(dossier, maintenant);
  sorties.push(p3.sortie);
  journal.consignerPasse(p3.sortie);

  // ── P4 — qualification ───────────────────────────────────────────────────
  const p4 = executerP4(dossier, maintenant);
  sorties.push(p4.sortie);
  journal.consignerPasse(p4.sortie);

  // ── P5 — contradiction : moyens saisis + moyens construits ──────────────
  const construits = construireMoyens(p2.postes, p3.analyses, p4.analyses);
  const tous = [...dossier.moyens, ...construits];
  const p5 = executerP5(dossier, tous, maintenant);
  sorties.push(p5.sortie);
  journal.consignerPasse(p5.sortie);

  // ── P6 — vérification : ancrage recalculé sur TOUTES les sorties ────────
  const supplementaires = [
    ...dossier.qualificationsEnvisagees.map((q) => q.id),
    ...tous.map((m) => m.id),
    ...p2.postes.map((p) => `poste-${p.numero}-${p.id}`),
  ];
  const divergences: string[] = [];
  for (const sortie of sorties) {
    const controle = verifierAncrage(sortie, dossier, supplementaires);
    divergences.push(...controle.divergences.map((d) => `${sortie.passe} : ${d}`));
  }
  const verdictP6 = { conforme: divergences.length === 0, divergences };

  const p6 = scellerSortie(
    'P6',
    dossier,
    verdictP6.conforme
      ? [{ enonce: `Ancrage recalculé sur ${sorties.length} sorties : aucune divergence.`, appuis: dossier.pieces.slice(0, 1).map((p) => p.id) }]
      : [],
    {
      moteur: MOTEUR_DETERMINISTE,
      traite: sorties.map((s) => s.passe),
      ecarte: divergences.map((d) => ({ quoi: d, motif: 'Divergence d’ancrage : bloquant (§6.4).' })),
      horodatage: maintenant,
    }
  );
  sorties.push(p6);
  journal.consignerPasse(p6);

  // La stratégie existante complète les moyens — axes, risques, échéances.
  const strategie = construireStrategie(analyse, nullites);

  return {
    dossier,
    analyse,
    nullites,
    strategie,
    postes: p2.postes,
    preuves: p3.analyses,
    qualifications: p4.analyses,
    moyens: p5.complets,
    moyensIncomplets: p5.incomplets,
    violations,
    sorties,
    verdictP6,
    journal,
  };
}
