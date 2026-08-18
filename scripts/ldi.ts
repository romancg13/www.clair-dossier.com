/**
 * LDI — interface en ligne de commande.
 *
 * Tout s'exécute en local : aucun appel réseau, aucune donnée du dossier ne
 * quitte la machine. C'est la façon recommandée d'utiliser LDI sur un dossier
 * réel couvert par le secret professionnel.
 *
 *   npm run ldi -- analyse examples/dossier-exemple.json
 *   npm run ldi -- analyse dossier.json --json > rapport.json
 *   npm run ldi -- document requete-nullite dossier.json
 *   npm run ldi -- minimise notes.txt --noms "Jean Dupont,SARL Martin"
 */
import { readFileSync } from 'node:fs';

import { minimiser, alertesResiduelles } from '../src/ldi/confidentialite';
import { genererDocument } from '../src/ldi/modules/documents';
import { analyser, rendreMarkdown } from '../src/ldi/pipeline';
import { sourcerRapport } from '../src/ldi/sourcage';
import type { ConfigRecherche } from '../src/ldi/modules/recherche';
import type { Dossier, TypeDocument } from '../src/ldi/types';
import { validerDossier } from '../src/ldi/validation';

const TYPES_DOCUMENT: TypeDocument[] = [
  'requete-nullite',
  'memoire-defense',
  'demande-mise-en-liberte',
  'memoire-appel',
];

const USAGE = `LDI — analyse de dossier pénal (exécution locale)

  npm run ldi -- analyse <dossier.json> [--json]
  npm run ldi -- document <type> <dossier.json>
  npm run ldi -- minimise <fichier.txt> [--noms "Nom 1,Nom 2"]
  npm run ldi -- sourcer <dossier.json>

« sourcer » interroge les sources officielles pour les références du rapport.
Identifiants lus dans l'environnement : LDI_JUDILIBRE_URL, LDI_JUDILIBRE_ENTETE,
LDI_JUDILIBRE_CLE (idem LDI_LEGIFRANCE_*). Sans eux, aucune décision n'est
retournée et le rapport le dit.

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

      const rapport = analyser(lireDossier(chemin));
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

    default:
      process.stdout.write(USAGE);
      process.exitCode = commande ? 1 : 0;
  }
}

void main();
