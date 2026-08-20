/**
 * DEFENSE OS — M1 : export et réimport du dossier, sans perte, sans réseau.
 *
 * ┌─ LE CONTRAT ────────────────────────────────────────────────────────────┐
 * │ Un dossier exporté puis réimporté est IDENTIQUE — pas équivalent,        │
 * │ identique : même sérialisation stable, même empreinte. C'est ce qui      │
 * │ permet à l'avocat d'emporter un dossier sur une clé, de le rouvrir au    │
 * │ palais, et de savoir qu'il regarde la même chose.                        │
 * │                                                                          │
 * │ L'import REFUSE une version de schéma inconnue : lire un format qu'on ne │
 * │ connaît pas produirait des champs devinés (§4.1, invariants).            │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import { empreinte } from '../ldi/journal';
import { validerDossier } from '../ldi/validation';
import {
  VERSION_SCHEMA,
  completerDossierPenal,
  versionAcceptee,
  type DossierPenal,
  type ExtensionPenale,
} from './modele';

export type ImportDossier =
  | { ok: true; dossier: DossierPenal; empreinte: string }
  | { ok: false; message: string };

/** Export : JSON indenté, version de schéma en tête, prêt pour un fichier. */
export function exporterDossier(dossier: DossierPenal): string {
  return JSON.stringify({ versionSchema: VERSION_SCHEMA, ...dossier, }, null, 2);
}

/**
 * Import. Trois barrières, dans l'ordre du moindre coût : JSON lisible,
 * version de schéma connue, forme du dossier d'analyse valide. Les champs v4
 * absents reçoivent leurs défauts VIDES — jamais des valeurs plausibles.
 */
export function importerDossier(json: string): ImportDossier {
  let brut: unknown;
  try {
    brut = JSON.parse(json);
  } catch (e) {
    return { ok: false, message: `JSON illisible — ${(e as Error).message}` };
  }

  if (typeof brut !== 'object' || brut === null) {
    return { ok: false, message: 'Le fichier ne contient pas un objet dossier.' };
  }

  const version = (brut as { versionSchema?: unknown }).versionSchema;
  // Un dossier d'analyse « historique » (sans champ de version) reste admis :
  // il précède le schéma 3.0 et ne porte que des champs que l'on sait lire.
  if (version !== undefined && !versionAcceptee(version)) {
    return {
      ok: false,
      message: `Version de schéma inconnue : « ${String(version)} ». Cette application lit la version ${VERSION_SCHEMA} — rien n'est importé, rien n'est deviné.`,
    };
  }

  const validation = validerDossier(brut);
  if (!validation.ok) return validation;

  const dossier = completerDossierPenal(validation.dossier, brut as Partial<ExtensionPenale>);
  return { ok: true, dossier, empreinte: empreinte(dossier) };
}

/** Aller-retour prouvé : export → import → même empreinte. */
export function allerRetourIdentique(dossier: DossierPenal): boolean {
  const reimporte = importerDossier(exporterDossier(dossier));
  return reimporte.ok && reimporte.empreinte === empreinte(dossier);
}
