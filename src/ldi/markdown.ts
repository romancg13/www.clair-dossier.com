/**
 * LDI — assainissement des cellules de tableau markdown.
 *
 * ┌─ POURQUOI ──────────────────────────────────────────────────────────────┐
 * │ Les tableaux du rapport et des actes générés contiennent du texte de     │
 * │ dossier : descriptions d'événements, intitulés de pièces, constats qui   │
 * │ les recopient. Ce texte vient de tiers — police, expert, partie adverse, │
 * │ client — et il n'a pas à décider de la mise en forme du document.        │
 * │                                                                          │
 * │ Le « | » était déjà échappé. Le saut de ligne ne l'était pas : une       │
 * │ description multiligne coupait la ligne du tableau en cours, faisait     │
 * │ disparaître les cellules suivantes — dont la pièce source — et mettait   │
 * │ fin au tableau, le reste retombant en texte libre. Un fait perdait donc  │
 * │ sa référence de pièce sans que rien ne le signale.                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Les caractères visés sont écrits en échappements. Un caractère de contrôle
 * recopié littéralement dans la source serait invisible à la relecture — et
 * c'est exactement la classe de défaut que ce module corrige.
 */

/**
 * Sauts de ligne sous toutes leurs formes, y compris les séparateurs Unicode
 * de ligne et de paragraphe que produit un copier-coller depuis un PDF.
 */
const RETOURS = /[\r\n\u2028\u2029]+/g;

/** Contrôles C0/C1 restants : invisibles, et sans usage dans une cellule. */
const CONTROLES = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;

/**
 * Ramène une valeur à une cellule de tableau sûre : une seule ligne, aucun
 * séparateur de colonne parasite.
 *
 * Le texte n'est pas tronqué, seulement remis à plat — un retour à la ligne
 * devient une espace. Supprimer le contenu serait pire que le déformer : dans
 * un acte, une phrase manquante ne se voit pas.
 */
export function celluleMarkdown(valeur: string): string {
  return valeur
    .replace(RETOURS, ' ')
    .replace(CONTROLES, '')
    .replace(/\|/g, '\\|')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
