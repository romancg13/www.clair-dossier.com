/**
 * LDI — câblage du module 2 sur le chemin de production.
 *
 * Le module de recherche existait, testé, et n'était appelé par rien. La
 * garantie « aucune jurisprudence hors source officielle » était donc vraie par
 * abstention : elle tenait parce qu'aucune jurisprudence n'était produite du
 * tout. Dès qu'un modèle de langage entre en jeu, l'abstention ne suffit plus —
 * il faut une liste de ce qui est réellement citable.
 *
 * Ce module produit cette liste : les références que le rapport invoque, leur
 * texte officiel quand il a pu être lu, et les décisions effectivement
 * retournées par la source. C'est cet ensemble, et lui seul, que le
 * vérificateur de citations acceptera en sortie.
 */
import { rechercher, type ConfigRecherche } from './modules/recherche';
import type { DecisionJurisprudentielle, EnonceJuridique, RapportLdi } from './types';

export type Sourcage = {
  /** Textes résolus, avec leur statut réel après interrogation. */
  textes: EnonceJuridique[];
  /** Décisions effectivement retournées par une source officielle. */
  decisions: DecisionJurisprudentielle[];
  /** Numéros de pourvoi citables. Vide si aucune source n'a répondu. */
  pourvoisAutorises: string[];
  /** Bloc markdown à verser au contexte du modèle. Vide si rien n'a été obtenu. */
  bloc: string;
  /** Ce que l'avocat doit savoir de cette exécution. */
  avertissement: string;
};

/** Références effectivement invoquées par un rapport, sans doublon. */
export function referencesDuRapport(rapport: RapportLdi): string[] {
  const refs: string[] = [];

  for (const point of rapport.nullites.points) refs.push(point.fondement.reference);
  for (const e of rapport.nullites.regimeNullite) refs.push(e.reference);
  for (const e of rapport.nullites.referencesComplementaires) refs.push(e.reference);
  for (const axe of rapport.strategie.axes) {
    for (const f of axe.fondements) refs.push(f.reference);
  }

  return [...new Set(refs)];
}

function rendreBloc(textes: EnonceJuridique[], decisions: DecisionJurisprudentielle[]): string {
  if (textes.length === 0 && decisions.length === 0) return '';

  const lignes: string[] = [];

  if (textes.length > 0) {
    lignes.push('### Textes');
    for (const t of textes) {
      lignes.push(
        `- **${t.reference}** (${t.statut}) — ${t.enonce}${t.source?.url ? `\n  Source : ${t.source.url}` : ''}`
      );
    }
  }

  if (decisions.length > 0) {
    lignes.push('', '### Décisions retournées par la source officielle');
    for (const d of decisions) {
      lignes.push(
        `- **${d.juridiction}, ${d.date}, n° ${d.numero}** — ${d.solution}` +
          (d.source ? `\n  Source : ${d.source.editeur}${d.source.url ? ` — ${d.source.url}` : ''}` : '')
      );
    }
  } else {
    lignes.push(
      '',
      "### Décisions\nAucune décision n'a été retournée. Aucun numéro de pourvoi n'est citable."
    );
  }

  return lignes.join('\n');
}

/**
 * Interroge les sources officielles pour les références d'un rapport.
 * Sans configuration, retourne un sourçage vide : c'est le comportement voulu,
 * et il rend l'absence de jurisprudence visible au lieu de la laisser deviner.
 */
export async function sourcerRapport(
  rapport: RapportLdi,
  config: ConfigRecherche = {}
): Promise<Sourcage> {
  const references = referencesDuRapport(rapport);
  const resultats = await Promise.all(references.map((r) => rechercher(r, config)));

  const textes = resultats.map((r) => r.texte).filter((t): t is EnonceJuridique => Boolean(t));
  const decisions = resultats.flatMap((r) => r.decisions);
  const avertissements = [...new Set(resultats.map((r) => r.avertissement).filter(Boolean))];

  return {
    textes,
    decisions,
    pourvoisAutorises: [...new Set(decisions.map((d) => d.numero))],
    bloc: rendreBloc(textes, decisions),
    avertissement:
      avertissements.join(' ') ||
      'Toutes les références ont été résolues sur leur source officielle.',
  };
}
