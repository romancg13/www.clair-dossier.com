/**
 * DEFENSE OS — M8 : les livrables.
 *
 * ┌─ CHAQUE LIVRABLE EST UN PROJET, ET IL LE DIT DEUX FOIS ─────────────────┐
 * │ En tête ET en pied : « Projet — à vérifier, compléter et signer par      │
 * │ l'avocat ». Il se termine par les « Vérifications indispensables avant   │
 * │ dépôt ». Les manques apparaissent EN ZONE VISIBLE, jamais en note de     │
 * │ bas de page (§7.10).                                                     │
 * │                                                                          │
 * │ Les références sont résolues à la génération contre le pack de sources : │
 * │ résolue ⇒ affichée avec ses cinq métadonnées ; absente ⇒ « fondement à   │
 * │ vérifier auprès de la source officielle ». Aucun troisième cas.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * L'export passe par la gate (M9) : ce module PRODUIT, il n'autorise rien.
 */
import type { Consigne, DossierPenal, Moyen } from './modele';
import { LIBELLES_AVANCEMENT, LIBELLES_NATURE, LIBELLES_PHASE, LIBELLES_STATUT_CLIENT } from './modele';
import { controlerExport, type LivrableAExporter, type VerdictExport } from './gate';
import type { ResultatChaine } from './orchestrateur';
import { resoudreReference, type SourceRecuperee } from './sources';

export type TypeLivrable =
  | 'synthese'
  | 'grille'
  | 'requete-nullite'
  | 'conclusions'
  | 'plaidoirie'
  | 'mise-en-liberte'
  | 'actes-a-solliciter'
  | 'questionnaire-client'
  | 'rapport-ancrage';

export const LIBELLES_LIVRABLE: Record<TypeLivrable, string> = {
  synthese: 'Note de synthèse de dossier',
  grille: 'Grille de régularité',
  'requete-nullite': 'Projet de conclusions de nullité',
  conclusions: 'Projet de conclusions au fond',
  plaidoirie: 'Trame de plaidoirie',
  'mise-en-liberte': 'Projet de demande de mise en liberté',
  'actes-a-solliciter': 'Actes à solliciter',
  'questionnaire-client': 'Questionnaire client',
  'rapport-ancrage': "Rapport d'ancrage (annexe de contrôle, non déposée)",
};

export type Livrable = {
  type: TypeLivrable;
  nom: string;
  corps: string;
  /** Le paquet que la gate contrôle — l'export n'existe pas sans verdict. */
  aExporter: LivrableAExporter;
  verdict: VerdictExport;
  consignesAppliquees: string[];
};

const MENTION_PROJET = "PROJET — à vérifier, compléter et signer par l'avocat";
const MENTION_FONDEMENT = 'fondement à vérifier auprès de la source officielle';

// ---------------------------------------------------------------------------
// Aides de rendu
// ---------------------------------------------------------------------------

/** Rend une référence : résolue avec ses métadonnées, ou la mention imposée. */
function rendreReference(reference: string, sources: SourceRecuperee[]): string {
  const resolue = resoudreReference(reference, sources);
  if (!resolue) return `${reference} — ${MENTION_FONDEMENT}`;
  return `${resolue.identifiant} (${resolue.source}, ${resolue.date}, ${resolue.url}, récupéré le ${resolue.recupereLe})`;
}

function referencesDe(moyens: Moyen[], sources: SourceRecuperee[]) {
  return moyens
    .flatMap((m) => m.references)
    .map((r) => resoudreReference(r, sources))
    .filter((s): s is SourceRecuperee => s !== null)
    .map((s) => ({ identifiant: s.identifiant, date: s.date, source: s.source, url: s.url, recupereLe: s.recupereLe }));
}

/**
 * Le moyen en quatre temps (§9.1) : grief · appuis et cotes · fondement ·
 * conséquence. La riposte et la contre-riposte suivent — l'audience jouée à
 * blanc fait partie du projet, pas d'une annexe.
 */
function rendreMoyen(moyen: Moyen, i: number, sources: SourceRecuperee[]): string {
  return [
    `### ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][i] ?? i + 1}. ${moyen.enonce}`,
    '',
    `**Appuis :** ${moyen.appuis.join(', ') || '[À COMPLÉTER : cotes]'}`,
    `**Fondement :** ${moyen.references.length > 0 ? moyen.references.map((r) => rendreReference(r, sources)).join(' ; ') : MENTION_FONDEMENT}`,
    `**Conséquence recherchée :** ${moyen.consequenceRecherchee}`,
    '',
    `> **Riposte prévisible :** ${moyen.ripostePrevue}`,
    `> **Contre-riposte :** ${moyen.contreRiposte}`,
  ].join('\n');
}

function blocManques(chaine: ResultatChaine): string {
  const manques = chaine.sorties.flatMap((s) => s.manques);
  if (manques.length === 0) return '';
  return [
    '## CE QUI MANQUE AU DOSSIER — à lire avant tout dépôt',
    '',
    ...manques.slice(0, 20).map((m) => `- **${m.quoi}** — nécessaire pour : ${m.necessairePour}. Action : ${m.action}`),
    manques.length > 20 ? `- … et ${manques.length - 20} autre(s) manque(s), listés au pupitre.` : '',
    '',
  ].filter(Boolean).join('\n');
}

function cadre(titre: string, dossier: DossierPenal, contenu: string, verifications: string[]): string {
  return [
    `> ${MENTION_PROJET}`,
    '',
    `# ${titre}`,
    '',
    `**Dossier :** ${dossier.reference}${dossier.initialesClient ? ` · ${dossier.initialesClient}` : ''}${dossier.juridiction ? ` · ${dossier.juridiction}` : ''}`,
    '',
    contenu.trim(),
    '',
    '## Vérifications indispensables avant dépôt',
    '',
    ...verifications.map((v) => `- [ ] ${v}`),
    '',
    `> ${MENTION_PROJET}`,
  ].join('\n');
}

const VERIFICATIONS_COMMUNES = [
  'Chaque cote citée existe au dossier et dit ce que le projet lui fait dire.',
  'Chaque fondement marqué « à vérifier » a été confronté à la source officielle.',
  'Les délais et la recevabilité du moyen sont vérifiés au stade actuel de la procédure.',
  "L'intérêt à agir est articulé pour chaque grief de nullité.",
];

// ---------------------------------------------------------------------------
// Les corps, par type
// ---------------------------------------------------------------------------

function corpsSynthese(chaine: ResultatChaine, sources: SourceRecuperee[]): string {
  const d = chaine.dossier;
  const griefs = chaine.postes.filter((p) => p.synthese === 'grief');
  return [
    `## Classement`,
    `Phase : ${LIBELLES_PHASE[d.phase]} · Statut : ${LIBELLES_STATUT_CLIENT[d.statutLiberte]} · Nature : ${d.natures.map((n) => LIBELLES_NATURE[n]).join(', ') || '[À COMPLÉTER]'} · Avancement : ${LIBELLES_AVANCEMENT[d.avancement]}`,
    '',
    `## Régularité — ${griefs.length} poste(s) portant grief sur 14 contrôlés`,
    ...griefs.flatMap((p) => p.griefs.map((g) => `- **[${p.intitule}]** ${g.enonce} (appuis : ${g.appuis.join(', ')})`)),
    griefs.length === 0 ? "Aucun grief envisagé sur les éléments saisis — ce qui ne vaut pas régularité : voir la grille, poste par poste." : '',
    '',
    `## Preuve — ${chaine.preuves.length} élément(s) analysé(s)`,
    ...chaine.preuves.map((a) => `- **${a.type}** (${a.elementId}) : établit ${a.etablit.toLowerCase()} N'établit pas : ${a.netablitPas.toLowerCase()}`),
    '',
    `## Moyens — ordre procédural`,
    ...chaine.moyens.map((m, i) => `${i + 1}. [${m.categorie}] ${m.enonce}${m.references.length ? ` — ${m.references.map((r) => rendreReference(r, sources)).join(' ; ')}` : ''}`),
    '',
    blocManques(chaine),
  ].filter(Boolean).join('\n');
}

function corpsGrille(chaine: ResultatChaine): string {
  return [
    '| # | Poste | Synthèse | Constat |',
    '|---|---|---|---|',
    ...chaine.postes.map(
      (p) => `| ${p.numero} | ${p.intitule} | ${p.synthese.toUpperCase()} | ${p.constat.replaceAll('|', '\\|')} |`
    ),
    '',
    blocManques(chaine),
  ].join('\n');
}

function corpsNullite(chaine: ResultatChaine, sources: SourceRecuperee[]): string {
  const nullites = chaine.moyens.filter((m) => m.categorie === 'in-limine-litis' || m.categorie === 'nullite');
  if (nullites.length === 0) {
    return "Aucun moyen de nullité construit sur les éléments saisis. Si un grief existe, le formaliser d'abord dans la grille de régularité.";
  }
  return [
    'IN LIMINE LITIS, et avant toute défense au fond :',
    '',
    ...nullites.map((m, i) => rendreMoyen(m, i, sources)),
    '',
    '## PAR CES MOTIFS',
    '',
    'PRONONCER la nullité des actes visés et de tous les actes dont ils sont le support nécessaire ;',
    'ORDONNER le retrait du dossier des pièces annulées ;',
    '[À COMPLÉTER : demandes additionnelles.]',
    '',
    blocManques(chaine),
  ].join('\n');
}

function corpsConclusions(chaine: ResultatChaine, sources: SourceRecuperee[]): string {
  const fond = chaine.moyens.filter((m) => m.categorie !== 'in-limine-litis' && m.categorie !== 'nullite');
  return [
    'À TITRE PRINCIPAL — sur l’imputation et la qualification :',
    '',
    ...fond.filter((m) => m.categorie !== 'peine').map((m, i) => rendreMoyen(m, i, sources)),
    '',
    'À TITRE SUBSIDIAIRE — sur la peine :',
    '',
    "Les paramètres d'individualisation et les pièces produites sont détaillés au volet peine ; aucun quantum n'est suggéré par l'outil.",
    '',
    '## PAR CES MOTIFS',
    '',
    'À titre principal, RENVOYER le prévenu des fins de la poursuite ;',
    'Subsidiairement, REQUALIFIER les faits et en tirer les conséquences ;',
    'Très subsidiairement, prononcer une peine tenant compte des éléments d’individualisation versés ;',
    '[À COMPLÉTER : demandes accessoires.]',
    '',
    blocManques(chaine),
  ].join('\n');
}

function corpsPlaidoirie(chaine: ResultatChaine): string {
  return [
    '## 1. Procédure (in limine litis, puis nullités)',
    ...chaine.moyens.filter((m) => m.categorie === 'nullite' || m.categorie === 'in-limine-litis')
      .map((m) => `- ${m.enonce}\n  - riposte attendue : ${m.ripostePrevue}\n  - réponse : ${m.contreRiposte}`),
    '',
    '## 2. Imputation',
    ...chaine.moyens.filter((m) => m.categorie === 'imputation').map((m) => `- ${m.enonce}`),
    '',
    '## 3. Qualification',
    ...chaine.moyens.filter((m) => m.categorie === 'requalification').map((m) => `- ${m.enonce}`),
    '',
    '## 4. Subsidiaire — peine',
    '- Garanties de représentation, personnalité, cadre alternatif : sur pièces.',
    '',
    blocManques(chaine),
  ].join('\n');
}

function corpsMiseEnLiberte(chaine: ResultatChaine): string {
  const d = chaine.dossier;
  if (d.statutLiberte !== 'detention-provisoire') {
    return `Le statut saisi du client est « ${LIBELLES_STATUT_CLIENT[d.statutLiberte]} » : ce projet suppose une détention provisoire. Vérifier le statut avant toute rédaction.`;
  }
  return [
    '## Sur l’absence de nécessité de la détention',
    'Reprendre un à un les critères légaux invoqués au titre de la détention et opposer, pour chacun, les éléments du dossier — [À COMPLÉTER sur pièces].',
    '',
    '## Garanties de représentation',
    '[À COMPLÉTER : domicile, activité, attaches — pièces jointes numérotées.]',
    '',
    '## PAR CES MOTIFS',
    'ORDONNER la mise en liberté, le cas échéant sous contrôle judiciaire dont les obligations seront débattues ;',
    '[À COMPLÉTER.]',
    '',
    blocManques(chaine),
  ].join('\n');
}

function corpsActes(chaine: ResultatChaine): string {
  const manques = chaine.sorties.flatMap((s) => s.manques);
  if (manques.length === 0) return 'Aucun manque recensé sur les éléments saisis.';
  return manques.map((m, i) => `${i + 1}. **${m.action}**\n   - comble : ${m.quoi}\n   - nécessaire pour : ${m.necessairePour}`).join('\n');
}

function corpsQuestionnaire(chaine: ResultatChaine): string {
  return [
    'À emporter en détention — questions au client, une par ligne, réponses au dos.',
    '',
    '## Interpellation et garde à vue',
    '- À quelle heure exacte avez-vous été interpellé, et où ?',
    '- Vos droits vous ont-ils été notifiés ? Quand, dans quelle langue ?',
    '- Avez-vous demandé un avocat, un médecin, à prévenir un proche ? Qu’en est-il advenu ?',
    '- Comment se sont déroulées les auditions (durée, pauses, état de fatigue) ?',
    '',
    '## Éléments à charge',
    ...chaine.preuves.map((a) => `- Sur « ${a.type} » : ${a.hypothesesAlternatives[0] ?? 'quelle est votre explication ?'} — votre version ?`),
    '',
    '## Situation personnelle',
    '- Domicile, activité, charges de famille : quels justificatifs pouvez-vous fournir ou faire fournir ?',
    '',
    blocManques(chaine),
  ].join('\n');
}

function corpsAncrage(chaine: ResultatChaine): string {
  return [
    "Chaque énoncé produit par les passes, avec ses appuis et son niveau d'ancrage.",
    'Annexe de contrôle : elle ne se dépose pas.',
    '',
    ...chaine.sorties.flatMap((s) => [
      `## ${s.passe} — ${s.resultats.length} énoncé(s), moteur ${s.moteur.type}`,
      ...s.resultats.map((r) => `- [${r.ancrage}] ${r.enonce}\n  appuis : ${r.appuis.join(', ')}`),
      ...(s.ecarte.length > 0 ? [`**Écarté (${s.ecarte.length})** :`, ...s.ecarte.map((e) => `- ${e.quoi} — ${e.motif}`)] : []),
      '',
    ]),
    `Verdict P6 : ${chaine.verdictP6.conforme ? 'aucune divergence d’ancrage.' : chaine.verdictP6.divergences.join(' ; ')}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Entrée du module
// ---------------------------------------------------------------------------

export function genererLivrable(
  type: TypeLivrable,
  chaine: ResultatChaine,
  options: { sources?: SourceRecuperee[]; consignes?: Consigne[] } = {}
): Livrable {
  const sources = options.sources ?? [];
  const consignes = options.consignes ?? [];
  const d = chaine.dossier;

  const CORPS: Record<TypeLivrable, () => string> = {
    synthese: () => corpsSynthese(chaine, sources),
    grille: () => corpsGrille(chaine),
    'requete-nullite': () => corpsNullite(chaine, sources),
    conclusions: () => corpsConclusions(chaine, sources),
    plaidoirie: () => corpsPlaidoirie(chaine),
    'mise-en-liberte': () => corpsMiseEnLiberte(chaine),
    'actes-a-solliciter': () => corpsActes(chaine),
    'questionnaire-client': () => corpsQuestionnaire(chaine),
    'rapport-ancrage': () => corpsAncrage(chaine),
  };

  const corps = cadre(LIBELLES_LIVRABLE[type], d, CORPS[type](), VERIFICATIONS_COMMUNES);

  // Un livrable ne porte devant la gate QUE les moyens qu'il rend réellement :
  // la nullité porte les moyens de procédure, les conclusions ceux du fond.
  // La trame de plaidoirie n'est pas un acte déposé — son corps reste contrôlé
  // (B4, B13, B15), mais elle ne porte pas de moyens à elle seule.
  const moyensPortes =
    type === 'requete-nullite'
      ? chaine.moyens.filter((m) => m.categorie === 'nullite' || m.categorie === 'in-limine-litis')
      : type === 'conclusions'
        ? chaine.moyens.filter((m) => m.categorie !== 'nullite' && m.categorie !== 'in-limine-litis')
        : [];

  const aExporter: LivrableAExporter = {
    nom: LIBELLES_LIVRABLE[type],
    corps,
    moyens: moyensPortes,
    references: referencesDe(moyensPortes, sources),
    sorties: chaine.sorties,
    contradictions: chaine.analyse.contradictions,
  };

  return {
    type,
    nom: LIBELLES_LIVRABLE[type],
    corps,
    aExporter,
    verdict: controlerExport(aExporter, d),
    consignesAppliquees: consignes.map((c) => c.id),
  };
}
