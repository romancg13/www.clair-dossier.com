/**
 * Taxonomie documentaire fermée et classification par règles (règle 0.2 : les
 * mentions structurantes d'une pièce — « FACTURE N° », « mise en demeure »,
 * en-têtes de courriel — se reconnaissent sans modèle). Chaque règle porte une
 * priorité (la nature d'un document prime sur son sujet : une mise en demeure qui
 * réclame une facture est une mise en demeure), une confiance de règle et l'extrait
 * qui justifie le choix (ancrage).
 */
import { extraitAutour } from "./extracteurs.ts";

export const CATEGORIES = [
  "facture", "avoir", "devis", "bon_de_commande", "contrat", "avenant", "conditions_generales",
  "mise_en_demeure", "courrier", "courriel", "releve_bancaire", "attestation", "justificatif_identite",
  "kbis", "statuts", "bulletin_paie", "contrat_travail", "lettre_licenciement", "decision_justice",
  "assignation", "proces_verbal", "formulaire", "photo", "autre",
] as const;
export type Categorie = (typeof CATEGORIES)[number];

/** Seuil de confiance imposé pour une classification (PARTIE 5.1). */
export const SEUIL_CLASSIFICATION = 0.85;

export type Classification = {
  categorie: Categorie;
  confiance: number;
  methode: "regles" | "modele" | "aucune";
  justification: { page: number; extrait: string; extrait_debut: number; extrait_fin: number } | null;
  /** Autres catégories dont une règle a aussi reconnu la marque (ambiguïté déclarée). */
  concurrentes: Categorie[];
};

type Regle = { categorie: Categorie; priorite: number; confiance: number; motifs: RegExp[]; tous?: boolean };

/** Texte replié pour la reconnaissance : minuscules, sans accents, blancs simples. */
export function replier(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const REGLES: Regle[] = [
  // Forme performative ou titre ; « votre / cette / la mise en demeure » désigne celle d'un tiers (réponse, contestation).
  { categorie: "mise_en_demeure", priorite: 10, confiance: 0.97, motifs: [/(?<!votre |cette |ladite |la |une |de la )mise en demeure|mettons en demeure|met(?:tons|s)? .{0,40}en demeure/] },
  { categorie: "assignation", priorite: 10, confiance: 0.95, motifs: [/\bassignation\b/, /tribunal|juridiction|audience/], tous: true },
  { categorie: "decision_justice", priorite: 9, confiance: 0.9, motifs: [/\b(jugement|ordonnance|arret)\b/, /tribunal|cour d'appel|conseil de prud'hommes|juge/], tous: true },
  { categorie: "lettre_licenciement", priorite: 9, confiance: 0.93, motifs: [/licenciement/, /notifi|entretien prealable/], tous: true },
  { categorie: "courriel", priorite: 9, confiance: 0.93, motifs: [/(^|\n)\s*de\s*:/, /(^|\n)\s*(a|à)\s*:/, /(^|\n)\s*objet\s*:/], tous: true },
  { categorie: "kbis", priorite: 9, confiance: 0.95, motifs: [/extrait k ?bis|registre du commerce et des societes/] },
  { categorie: "bulletin_paie", priorite: 9, confiance: 0.95, motifs: [/bulletin de (paie|salaire)/] },
  { categorie: "contrat_travail", priorite: 9, confiance: 0.93, motifs: [/contrat de travail/] },
  { categorie: "proces_verbal", priorite: 8, confiance: 0.9, motifs: [/proces[- ]verbal/] },
  { categorie: "avenant", priorite: 8, confiance: 0.93, motifs: [/\bavenant\b/] },
  { categorie: "bon_de_commande", priorite: 8, confiance: 0.95, motifs: [/bon de commande|commande n[°o]|purchase order/] },
  { categorie: "devis", priorite: 8, confiance: 0.93, motifs: [/\bdevis\b/, /total|montant|prix/], tous: true },
  { categorie: "avoir", priorite: 8, confiance: 0.92, motifs: [/\bavoir n[°o]|facture d'avoir|note de credit/] },
  { categorie: "releve_bancaire", priorite: 8, confiance: 0.92, motifs: [/releve de compte|releve bancaire|solde (crediteur|debiteur)|ancien solde|nouveau solde/] },
  { categorie: "attestation", priorite: 7, confiance: 0.9, motifs: [/\battestation\b|\batteste\b/] },
  { categorie: "conditions_generales", priorite: 7, confiance: 0.92, motifs: [/conditions generales (de vente|d'utilisation|de service)/] },
  { categorie: "statuts", priorite: 7, confiance: 0.9, motifs: [/\bstatuts\b/, /societe|capital social|associes/], tous: true },
  { categorie: "justificatif_identite", priorite: 7, confiance: 0.9, motifs: [/carte nationale d'identite|passeport|titre de sejour/] },
  { categorie: "facture", priorite: 6, confiance: 0.95, motifs: [/\bfacture n[°o]|\bfacture\b.{0,40}\bn[°o]/, /total ttc|total ht|tva|montant/], tous: true },
  { categorie: "contrat", priorite: 6, confiance: 0.9, motifs: [/\bcontrat\b/, /article \d|entre les soussignes|clause|les parties/], tous: true },
  { categorie: "formulaire", priorite: 5, confiance: 0.85, motifs: [/cerfa|formulaire/] },
  { categorie: "courrier", priorite: 4, confiance: 0.86, motifs: [/lettre recommandee|madame, monsieur|veuillez agreer|salutations distinguees/] },
];

/** Classe une pièce d'après le texte de ses pages (règles). */
export function classerParRegles(pages: { page: number; texte: string }[]): Classification {
  const lisibles = pages.filter((p) => p.texte.trim().length > 0);
  if (lisibles.length === 0) return { categorie: "autre", confiance: 0, methode: "aucune", justification: null, concurrentes: [] };
  // L'en-tête pèse plus : première page en entier, puis le reste.
  const candidats: { regle: Regle; page: number; index: number; longueur: number; texte: string }[] = [];
  for (const regle of REGLES) {
    for (const p of lisibles) {
      const replie = replier(p.texte);
      const trouves = regle.motifs.map((m) => replie.match(m));
      const ok = regle.tous ? trouves.every(Boolean) : trouves.some(Boolean);
      if (!ok) continue;
      const premier = trouves.find(Boolean)!;
      candidats.push({ regle, page: p.page, index: premier.index ?? 0, longueur: premier[0].length, texte: p.texte });
      break; // une occurrence par règle suffit
    }
  }
  if (candidats.length === 0) return { categorie: "autre", confiance: 0.5, methode: "regles", justification: null, concurrentes: [] };
  candidats.sort((a, b) => b.regle.priorite - a.regle.priorite || b.regle.confiance - a.regle.confiance);
  const gagnant = candidats[0];
  const concurrentes = candidats.slice(1).map((c) => c.regle.categorie).filter((c, i, arr) => c !== gagnant.regle.categorie && arr.indexOf(c) === i);
  // Une autre règle de même priorité qui a reconnu sa marque = ambiguïté : confiance abaissée.
  const ambigue = candidats.some((c) => c !== gagnant && c.regle.priorite === gagnant.regle.priorite && c.regle.categorie !== gagnant.regle.categorie);
  const confiance = Math.round((ambigue ? gagnant.regle.confiance - 0.15 : gagnant.regle.confiance) * 1000) / 1000;
  // Le texte replié conserve les positions (NFD retire seulement les diacritiques… sauf ligatures) :
  // on recherche donc la justification dans le texte d'origine par position approchée.
  const zone = extraitAutour(gagnant.texte, Math.min(gagnant.index, gagnant.texte.length - 1), Math.min(gagnant.index + gagnant.longueur, gagnant.texte.length));
  return {
    categorie: gagnant.regle.categorie,
    confiance,
    methode: "regles",
    justification: { page: gagnant.page, extrait: zone.extrait, extrait_debut: zone.extrait_debut, extrait_fin: zone.extrait_fin },
    concurrentes,
  };
}

/** Nom de fichier normalisé : AAAA-MM-JJ_categorie_reference.ext (I3 : l'original garde son nom). */
export function nomNormalise(params: { categorie: Categorie; date?: string | null; reference?: string | null; nomOriginal: string }): string {
  const ext = (params.nomOriginal.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "pdf").toLowerCase();
  const morceaux = [params.date ?? "sans-date", params.categorie];
  if (params.reference) morceaux.push(params.reference.replace(/[^A-Za-z0-9-]+/g, "-"));
  return `${morceaux.join("_")}.${ext}`;
}
