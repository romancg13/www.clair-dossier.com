/**
 * DEFENSE OS — pack de sources officielles (§9.2).
 *
 * ┌─ LE PONT ENTRE LA CLI ET L'ATELIER ─────────────────────────────────────┐
 * │ La CLI interroge les API officielles (elle seule détient les secrets) et │
 * │ produit un PACK : un fichier JSON daté. L'atelier l'importe. C'est le    │
 * │ SEUL chemin par lequel une référence juridique entre à l'écran.          │
 * │                                                                          │
 * │ L'import rejette toute entrée aux métadonnées B3 incomplètes, en nommant │
 * │ ce qui manque — une référence sans URL officielle ou sans horodatage de  │
 * │ récupération n'est pas affichable, donc elle n'entre pas.                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import type { ReferenceAffichee } from './gate';
import { referenceComplete } from './gate';

export const TYPE_PACK = 'pack-sources-defense-os';
export const VERSION_PACK = '1';

export type SourceRecuperee = ReferenceAffichee & {
  type: 'texte' | 'jurisprudence';
  /** Énoncé ou sommaire tel que la source l'a rendu — jamais réécrit. */
  contenu: string;
  /** Servie depuis le cache local de la CLI ? La date d'origine fait foi. */
  depuisCache: boolean;
};

export type PackSources = {
  type: typeof TYPE_PACK;
  version: string;
  produitLe: string;
  sources: SourceRecuperee[];
};

export type ImportPack =
  | { ok: true; sources: SourceRecuperee[]; rejetees: { identifiant: string; motif: string }[] }
  | { ok: false; message: string };

/** Construit un pack — utilisé par la CLI après récupération. */
export function construirePack(sources: SourceRecuperee[], produitLe = new Date().toISOString()): PackSources {
  return { type: TYPE_PACK, version: VERSION_PACK, produitLe, sources };
}

/**
 * Lit un pack. Les entrées incomplètes sont REJETÉES une à une, avec le champ
 * manquant nommé — le pack n'est pas refusé en bloc pour une entrée abîmée,
 * mais rien d'incomplet ne passe.
 */
export function lirePack(json: string): ImportPack {
  let brut: unknown;
  try {
    brut = JSON.parse(json);
  } catch (e) {
    return { ok: false, message: `Pack illisible — ${(e as Error).message}` };
  }

  if (typeof brut !== 'object' || brut === null) return { ok: false, message: 'Le pack doit être un objet JSON.' };
  const pack = brut as Partial<PackSources>;
  if (pack.type !== TYPE_PACK) {
    return { ok: false, message: `Ce fichier n'est pas un pack de sources (type : ${String(pack.type ?? 'absent')}).` };
  }
  if (pack.version !== VERSION_PACK) {
    return { ok: false, message: `Version de pack inconnue : « ${String(pack.version)} ». Cette application lit la version ${VERSION_PACK}.` };
  }
  if (!Array.isArray(pack.sources)) return { ok: false, message: 'Le pack ne contient pas de tableau « sources ».' };

  const sources: SourceRecuperee[] = [];
  const rejetees: { identifiant: string; motif: string }[] = [];

  for (const brute of pack.sources) {
    const s = brute as Partial<SourceRecuperee>;
    if (!referenceComplete(s)) {
      rejetees.push({
        identifiant: s.identifiant ?? '(sans identifiant)',
        motif: `Métadonnées B3 incomplètes : il manque ${[
          !s.identifiant?.trim() && 'identifiant',
          !s.date?.trim() && 'date',
          !s.source?.trim() && 'source',
          !s.url?.trim() && 'URL officielle',
          !s.recupereLe?.trim() && 'horodatage de récupération',
        ]
          .filter(Boolean)
          .join(', ')}.`,
      });
      continue;
    }
    if (s.type !== 'texte' && s.type !== 'jurisprudence') {
      rejetees.push({ identifiant: s.identifiant!, motif: `Type inconnu : « ${String(s.type)} ».` });
      continue;
    }
    sources.push({
      identifiant: s.identifiant!,
      date: s.date!,
      source: s.source!,
      url: s.url!,
      recupereLe: s.recupereLe!,
      type: s.type,
      contenu: typeof s.contenu === 'string' ? s.contenu : '',
      depuisCache: s.depuisCache === true,
    });
  }

  return { ok: true, sources, rejetees };
}

/**
 * Résout une référence contre les sources importées, insensible à la casse.
 * Absente ⇒ null : c'est l'appelant qui écrit la mention imposée.
 */
export function resoudreReference(reference: string, sources: SourceRecuperee[]): SourceRecuperee | null {
  const cible = reference.trim().toLowerCase();
  return sources.find((s) => s.identifiant.trim().toLowerCase() === cible) ?? null;
}
