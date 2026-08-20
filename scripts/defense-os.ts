/**
 * Defense OS — interface en ligne de commande.
 *
 * ┌─ LA CLI EST LE SEUL COMPOSANT QUI TOUCHE AU RÉSEAU ─────────────────────┐
 * │ Sources officielles (pack-sources, sourcer), moteur d'inférence local    │
 * │ (generer), mode distant verrouillé (D-3). Les secrets vivent dans        │
 * │ l'environnement, jamais dans le dépôt ni dans le navigateur (B8).        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Codes de sortie, stables pour les scripts :
 *   0  exécution normale
 *   1  usage incorrect
 *   2  analyse : au moins une anomalie relevée
 *   3  sources : aucune décision obtenue
 *   4  rejeu : écart avec le journal
 *   5  generer : sortie non conforme (citations ou structure)
 *   6  livrable : export bloqué par la gate
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { minimiser, alertesResiduelles } from '../src/ldi/confidentialite';
import { genererDocument } from '../src/ldi/modules/documents';
import { analyser, rendreMarkdown } from '../src/ldi/pipeline';
import { journaliser, rejouer } from '../src/ldi/journal';
import { sourcerRapport } from '../src/ldi/sourcage';
import { verifierCitations } from '../src/ldi/citations';
import { INVITE_SYSTEME, construireMessage } from '../src/ldi/prompt';
import { validerStructure } from '../src/ldi/reponse';
import type { ConfigRecherche } from '../src/ldi/modules/recherche';
import type { Dossier, TypeDocument } from '../src/ldi/types';
import { validerDossier } from '../src/ldi/validation';
import { completerDossierPenal, type ExtensionPenale } from '../src/noyau/modele';
import { executerChaine } from '../src/noyau/orchestrateur';
import { genererLivrable, LIBELLES_LIVRABLE, type TypeLivrable } from '../src/noyau/livrables';
import { rendreVerdict } from '../src/noyau/gate';
import { construirePack, lirePack, type SourceRecuperee } from '../src/noyau/sources';
import { creerMoteurDistant, creerMoteurLocal, type MoteurInference } from '../src/noyau/moteur';

const TYPES_DOCUMENT: TypeDocument[] = [
  'requete-nullite',
  'memoire-defense',
  'demande-mise-en-liberte',
  'memoire-appel',
];

const TYPES_LIVRABLE = Object.keys(LIBELLES_LIVRABLE) as TypeLivrable[];

const USAGE = `Defense OS — poste de travail pénal (exécution locale)

  npm run ldi -- analyse <dossier.json> [--json] [--journal <j.json>]
  npm run ldi -- chaine <dossier.json>            passes P1→P6, postes, moyens
  npm run ldi -- livrable <type> <dossier.json> [--pack <sources.json>]
  npm run ldi -- document <type> <dossier.json>
  npm run ldi -- minimise <fichier.txt> [--noms "Nom 1,Nom 2"]
  npm run ldi -- sourcer <dossier.json>
  npm run ldi -- pack-sources <dossier.json> --sortie <pack.json> [--cache]
  npm run ldi -- generer <dossier.json> --question "…" [--noms "…"]
                 [--distant --consentement-dossier <réf>]
  npm run ldi -- rejouer <journal.json> <dossier.json>

Codes de sortie : 0 normal · 1 usage · 2 anomalie relevée · 3 aucune décision
obtenue · 4 écart de rejeu · 5 sortie générée non conforme · 6 export bloqué.

« pack-sources » interroge les API officielles (secrets dans l'environnement :
LDI_JUDILIBRE_*, LDI_LEGIFRANCE_*) et écrit un pack importable dans l'atelier.
Avec --cache, le pack existant à --sortie est fusionné : une source déjà
récupérée garde sa date de récupération d'origine.

« generer » : moteur LOCAL par défaut (LDI_MOTEUR_LOCAL_URL, défaut
http://127.0.0.1:11434, et LDI_MOTEUR_LOCAL_MODELE). Le mode DISTANT est
construit mais désactivé : il exige LDI_DISTANT_ACTIVE=oui dans
l'environnement ET --distant --consentement-dossier <réf> — les deux,
à chaque appel. Ce qui part est le rapport MINIMISÉ, jamais les pièces.

Types de livrable : ${TYPES_LIVRABLE.join(', ')}
Types de document : ${TYPES_DOCUMENT.join(', ')}
`;

function echec(message: string): never {
  process.stderr.write(`Erreur : ${message}\n\n${USAGE}`);
  process.exit(1);
}

function lireDossier(chemin: string): Dossier {
  let brut: string;
  try {
    brut = readFileSync(chemin, 'utf-8');
  } catch {
    echec(`fichier introuvable : ${chemin}`);
  }

  let parse: unknown;
  try {
    parse = JSON.parse(brut);
  } catch (e) {
    echec(`JSON invalide dans ${chemin} — ${(e as Error).message}`);
  }

  const validation = validerDossier(parse);
  if (!validation.ok) echec(validation.message);
  return validation.dossier;
}

/** Dossier v4 : la forme d'analyse validée, complétée des champs pénaux. */
function lireDossierPenal(chemin: string) {
  let brut: unknown;
  try {
    brut = JSON.parse(readFileSync(chemin, 'utf-8'));
  } catch (e) {
    echec(`dossier illisible : ${(e as Error).message}`);
  }
  const validation = validerDossier(brut);
  if (!validation.ok) echec(validation.message);
  return completerDossierPenal(validation.dossier, brut as Partial<ExtensionPenale>);
}

function lireSourcesOptionnelles(cheminPack: string | undefined): SourceRecuperee[] {
  if (!cheminPack) return [];
  const resultat = lirePack(readFileSync(cheminPack, 'utf-8'));
  if (!resultat.ok) echec(`pack de sources : ${resultat.message}`);
  if (resultat.rejetees.length > 0) {
    process.stderr.write(`${resultat.rejetees.length} entrée(s) du pack rejetée(s) (B3) :\n`);
    for (const r of resultat.rejetees) process.stderr.write(`  - ${r.identifiant} : ${r.motif}\n`);
  }
  return resultat.sources;
}

/**
 * Choisit le moteur : local par défaut (D-2), distant seulement si TOUS les
 * verrous sont là — et même alors, le moteur revalide à chaque appel.
 */
function choisirMoteur(args: string[]): MoteurInference {
  if (args.includes('--distant')) {
    const reference = optionValeur(args, '--consentement-dossier');
    return creerMoteurDistant({
      active: process.env.LDI_DISTANT_ACTIVE,
      cleApi: process.env.ANTHROPIC_API_KEY,
      modele: process.env.LDI_MODEL ?? 'claude-opus-5',
      consentement: reference ? { dossierReference: reference, horodatage: new Date().toISOString() } : null,
    });
  }
  return creerMoteurLocal({
    url: process.env.LDI_MOTEUR_LOCAL_URL ?? 'http://127.0.0.1:11434',
    modele: process.env.LDI_MOTEUR_LOCAL_MODELE ?? 'mistral',
  });
}

function optionValeur(args: string[], nom: string): string | undefined {
  const index = args.indexOf(nom);
  if (index === -1) return undefined;
  // `--noms --json` ne doit pas pseudonymiser la chaîne « --json ».
  const valeur = args[index + 1];
  return valeur && !valeur.startsWith('--') ? valeur : undefined;
}

/** Configuration des sources, lue dans l'environnement — jamais dans le code. */
function configSources(): ConfigRecherche {
  const source = (prefixe: string) => {
    const urlBase = process.env[`${prefixe}_URL`];
    const valeurAuth = process.env[`${prefixe}_CLE`];
    if (!urlBase || !valeurAuth) return undefined;
    return { urlBase, enteteAuth: process.env[`${prefixe}_ENTETE`] ?? 'KeyId', valeurAuth };
  };
  return { judilibre: source('LDI_JUDILIBRE'), legifrance: source('LDI_LEGIFRANCE') };
}

async function main(): Promise<void> {
  const [commande, ...args] = process.argv.slice(2);

  switch (commande) {
    case 'analyse': {
      const chemin = args.find((a) => !a.startsWith('--'));
      if (!chemin) echec('chemin du dossier manquant.');

      const dossier = lireDossier(chemin);
      const rapport = analyser(dossier);

      const cheminJournal = optionValeur(args, '--journal');
      if (cheminJournal) {
        writeFileSync(cheminJournal, `${JSON.stringify(journaliser(dossier, rapport), null, 2)}\n`, 'utf-8');
        process.stderr.write(`Journal écrit : ${cheminJournal}\n`);
      }

      if (args.includes('--json')) {
        process.stdout.write(`${JSON.stringify(rapport, null, 2)}\n`);
      } else {
        process.stdout.write(`${rendreMarkdown(rapport)}\n`);
      }
      // Une anomalie relevée doit se voir depuis un script : code de sortie 2.
      process.exitCode = rapport.nullites.anomalies.length > 0 ? 2 : 0;
      return;
    }

    case 'document': {
      const [type, chemin] = args.filter((a) => !a.startsWith('--'));
      if (!type || !TYPES_DOCUMENT.includes(type as TypeDocument)) {
        echec(`type de document inconnu : ${type ?? '(aucun)'}`);
      }
      if (!chemin) echec('chemin du dossier manquant.');

      const rapport = analyser(lireDossier(chemin));
      const doc = genererDocument(type as TypeDocument, rapport.dossier, rapport.strategie);
      process.stdout.write(`${doc.corps}\n`);
      process.stderr.write(`\n${doc.aCompleter.length} emplacement(s) à compléter avant dépôt.\n`);
      return;
    }

    case 'minimise': {
      const chemin = args.find((a) => !a.startsWith('--'));
      if (!chemin) echec('chemin du fichier manquant.');

      const noms = (optionValeur(args, '--noms') ?? '')
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);

      let source: string;
      try {
        source = readFileSync(chemin, 'utf-8');
      } catch {
        echec(`fichier introuvable ou illisible : ${chemin}`);
      }
      const { texte, correspondances } = minimiser(source, noms);
      process.stdout.write(`${texte}\n`);

      process.stderr.write(`\n${correspondances.size} valeur(s) pseudonymisée(s).\n`);
      const alertes = alertesResiduelles(texte);
      if (alertes.length > 0) {
        process.stderr.write('\nRisque résiduel de ré-identification :\n');
        for (const alerte of alertes) process.stderr.write(`  - ${alerte}\n`);
      }
      return;
    }

    case 'rejouer': {
      const [cheminJournal, cheminDossier] = args.filter((a) => !a.startsWith('--'));
      if (!cheminJournal || !cheminDossier) echec('usage : rejouer <journal.json> <dossier.json>');

      let journal;
      try {
        journal = JSON.parse(readFileSync(cheminJournal, 'utf-8'));
      } catch (e) {
        echec(`journal illisible : ${(e as Error).message}`);
      }

      const controle = rejouer(journal, lireDossier(cheminDossier));
      if (controle.identique) {
        process.stdout.write(
          `Conforme au journal du ${journal.executeLe} — dossier et moteur inchangés.\n` +
            `Les ${journal.constats.length} constats enregistrés restent reproductibles.\n`
        );
        return;
      }

      process.stdout.write('Écart avec le journal :\n');
      for (const ecart of controle.ecarts) process.stdout.write(`  - ${ecart}\n`);
      process.exitCode = 4;
      return;
    }

    case 'sourcer': {
      const chemin = args.find((a) => !a.startsWith('--'));
      if (!chemin) echec('chemin du dossier manquant.');

      const sourcage = await sourcerRapport(analyser(lireDossier(chemin)), configSources());
      process.stdout.write(`# Sources officielles\n\n${sourcage.bloc}\n`);
      process.stderr.write(`\n${sourcage.avertissement}\n`);
      process.stderr.write(
        `${sourcage.textes.length} texte(s), ${sourcage.decisions.length} décision(s), ` +
          `${sourcage.pourvoisAutorises.length} pourvoi(s) citable(s).\n`
      );
      // Aucune décision obtenue : le signaler au script appelant.
      process.exitCode = sourcage.decisions.length === 0 ? 3 : 0;
      return;
    }

    case 'chaine': {
      const chemin = args.find((a) => !a.startsWith('--'));
      if (!chemin) echec('chemin du dossier manquant.');

      const dossier = lireDossierPenal(chemin);
      const chaine = executerChaine(dossier);

      process.stdout.write(`# Chaîne P1→P6 — dossier ${dossier.reference}\n\n`);
      for (const sortie of chaine.sorties) {
        process.stdout.write(
          `- ${sortie.passe} : ${sortie.resultats.length} énoncé(s), ${sortie.manques.length} manque(s), ${sortie.ecarte.length} écarté(s)\n`
        );
      }
      process.stdout.write(`\n## Postes de régularité\n\n`);
      for (const poste of chaine.postes) {
        process.stdout.write(`${String(poste.numero).padStart(2)}. [${poste.synthese.toUpperCase().padEnd(7)}] ${poste.intitule} — ${poste.constat}\n`);
      }
      process.stdout.write(`\n## Moyens (ordre procédural)\n\n`);
      for (const moyen of chaine.moyens) {
        process.stdout.write(`- [${moyen.categorie}] ${moyen.enonce}\n`);
      }
      process.stdout.write(`\nVerdict P6 : ${chaine.verdictP6.conforme ? 'conforme' : chaine.verdictP6.divergences.join(' ; ')}\n`);
      process.exitCode = chaine.postes.some((p) => p.synthese === 'grief') ? 2 : 0;
      return;
    }

    case 'livrable': {
      const positionnels = args.filter((a) => !a.startsWith('--') && a !== optionValeur(args, '--pack'));
      const [typeLivrable, cheminDossier] = positionnels;
      if (!typeLivrable || !TYPES_LIVRABLE.includes(typeLivrable as TypeLivrable)) {
        echec(`type de livrable inconnu : ${typeLivrable ?? '(aucun)'} — attendus : ${TYPES_LIVRABLE.join(', ')}`);
      }
      if (!cheminDossier) echec('chemin du dossier manquant.');

      const sources = lireSourcesOptionnelles(optionValeur(args, '--pack'));
      const chaine = executerChaine(lireDossierPenal(cheminDossier));
      const livrable = genererLivrable(typeLivrable as TypeLivrable, chaine, { sources });

      if (!livrable.verdict.autorise) {
        // Rien sur stdout : un export bloqué ne produit PAS de document.
        process.stderr.write(`${rendreVerdict(livrable.verdict)}\n`);
        process.exitCode = 6;
        return;
      }
      process.stdout.write(`${livrable.corps}\n`);
      return;
    }

    case 'pack-sources': {
      const chemin = args.find((a) => !a.startsWith('--') && a !== optionValeur(args, '--sortie'));
      const sortiePack = optionValeur(args, '--sortie');
      if (!chemin) echec('chemin du dossier manquant.');
      if (!sortiePack) echec('destination manquante : --sortie <pack.json>');

      const sourcage = await sourcerRapport(analyser(lireDossier(chemin)), configSources());
      const recuperees: SourceRecuperee[] = [];
      const incompletes: string[] = [];

      for (const texte of sourcage.textes) {
        // Seul un énoncé VÉRIFIÉ pendant l'exécution porte les cinq
        // métadonnées : un statut « à vérifier » n'entre pas au pack.
        if (texte.statut === 'verifie' && texte.source?.url && texte.source.consulteLe) {
          recuperees.push({
            identifiant: texte.reference,
            date: texte.source.consulteLe,
            source: texte.source.editeur,
            url: texte.source.url,
            recupereLe: texte.source.consulteLe,
            type: 'texte',
            contenu: texte.enonce,
            depuisCache: false,
          });
        } else {
          incompletes.push(texte.reference);
        }
      }
      for (const decision of sourcage.decisions) {
        if (decision.source?.url && decision.source.consulteLe) {
          recuperees.push({
            identifiant: decision.numero,
            date: decision.date,
            source: decision.source.editeur,
            url: decision.source.url,
            recupereLe: decision.source.consulteLe,
            type: 'jurisprudence',
            contenu: `${decision.juridiction}, ${decision.date}, n° ${decision.numero} — ${decision.solution}`,
            depuisCache: false,
          });
        }
      }

      // --cache : fusion avec le pack existant. Une source déjà récupérée
      // garde sa date d'origine ; une source fraîche remplace l'ancienne.
      let fusionnees = recuperees;
      if (args.includes('--cache') && existsSync(sortiePack)) {
        const existant = lirePack(readFileSync(sortiePack, 'utf-8'));
        if (existant.ok) {
          const fraiches = new Set(recuperees.map((s) => s.identifiant.toLowerCase()));
          fusionnees = [
            ...recuperees,
            ...existant.sources
              .filter((s) => !fraiches.has(s.identifiant.toLowerCase()))
              .map((s) => ({ ...s, depuisCache: true })),
          ];
        }
      }

      writeFileSync(sortiePack, `${JSON.stringify(construirePack(fusionnees), null, 2)}\n`, 'utf-8');
      process.stderr.write(
        `${fusionnees.length} source(s) au pack (${recuperees.length} fraîche(s)). ${sourcage.avertissement}\n` +
          (incompletes.length > 0
            ? `Non versées, faute de vérification pendant l'exécution : ${incompletes.join(', ')}.\n`
            : '')
      );
      process.exitCode = sourcage.decisions.length === 0 ? 3 : 0;
      return;
    }

    case 'generer': {
      const chemin = args.find((a) => !a.startsWith('--') && a !== optionValeur(args, '--question') && a !== optionValeur(args, '--noms') && a !== optionValeur(args, '--consentement-dossier'));
      const question = optionValeur(args, '--question');
      if (!chemin) echec('chemin du dossier manquant.');
      if (!question) echec('question manquante : --question "…"');

      const dossier = lireDossier(chemin);
      const rapport = analyser(dossier);
      const noms = (optionValeur(args, '--noms') ?? '').split(',').map((n) => n.trim()).filter(Boolean);
      const { texte: rapportMinimise } = minimiser(rendreMarkdown(rapport), noms);

      const alertes = alertesResiduelles(rapportMinimise);
      if (alertes.length > 0 && args.includes('--distant')) {
        // Vers l'extérieur, un risque résiduel bloque : la CLI n'a pas de case
        // à cocher, elle a un drapeau explicite.
        if (!args.includes('--assumer-alertes')) {
          echec(
            `risque résiduel de ré-identification :\n  - ${alertes.join('\n  - ')}\n` +
              'Compléter --noms, ou assumer explicitement avec --assumer-alertes.'
          );
        }
      }

      const moteur = choisirMoteur(args);
      const sourcage = await sourcerRapport(rapport, configSources());
      const message = construireMessage({ rapport: rapportMinimise, sources: sourcage.bloc, question });

      process.stderr.write(`Moteur : ${moteur.descriptif.type}${moteur.descriptif.modele ? ` (${moteur.descriptif.modele})` : ''}\n`);
      const reponse = await moteur.generer(INVITE_SYSTEME, message);
      if (!reponse.ok) {
        process.stderr.write(`${reponse.erreur}\n`);
        process.stderr.write("Le mode déterministe reste disponible : `npm run ldi -- analyse` et `chaine` produisent sans modèle.\n");
        process.exitCode = 1;
        return;
      }

      // Vérifications APRÈS génération : citations contre l'autorité réelle
      // de cette exécution, structure contre les sections imposées.
      const verification = verifierCitations(reponse.texte, {
        references: sourcage.textes.map((t) => ({ reference: t.reference })),
        decisions: sourcage.decisions.map((d) => ({ numero: d.numero })),
      });
      const structure = validerStructure(verification.texte);

      process.stdout.write(`${verification.texte}\n`);
      if (!verification.conforme) process.stderr.write(`\n${verification.rapport}\n`);
      if (!structure.conforme) {
        process.stderr.write(`\nSections imposées absentes : ${structure.sectionsManquantes.join(', ')}.\n`);
      }
      process.stderr.write('\nPROJET — à vérifier, compléter et signer par l’avocat.\n');
      process.exitCode = verification.conforme && structure.conforme ? 0 : 5;
      return;
    }

    default:
      process.stdout.write(USAGE);
      process.exitCode = commande ? 1 : 0;
  }
}

void main();
