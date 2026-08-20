/**
 * DEFENSE OS — contrat de sortie des sept passes (§3.2, §3.3).
 *
 * ┌─ LA RÈGLE QUI COMMANDE CE FICHIER ──────────────────────────────────────┐
 * │ Toute affirmation produite par une passe pointe au moins un appui        │
 * │ identifié — cote, acte, fragment, mesure, source récupérée. Une sortie   │
 * │ non ancrée est BLOQUÉE, pas signalée (B16) : elle passe dans `ecarte`    │
 * │ avec son motif, et n'atteint jamais l'affichage.                         │
 * │                                                                          │
 * │ Le niveau d'ancrage n'est pas déclaré par la passe qui produit : il est  │
 * │ CALCULÉ contre l'ensemble des identifiants connus du dossier. Une passe  │
 * │ ne peut donc pas s'auto-attribuer un ancrage « direct ».                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Chaque passe déclare aussi ce qu'elle a traité, écarté et laissé ouvert :
 * c'est la traçabilité du travail de la machine, que l'avocat peut auditer.
 */
import { VERSION_SCHEMA, type DossierPenal } from './modele';

export type IdPasse = 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';

export const NOMS_PASSES: Record<IdPasse, string> = {
  P0: 'Ingestion',
  P1: 'Greffe',
  P2: 'Contrôle',
  P3: 'Preuve',
  P4: 'Qualification',
  P5: 'Contradiction',
  P6: 'Vérification',
};

export type NiveauAncrage = 'direct' | 'partiel' | 'absent';

export type EnonceAncre = {
  enonce: string;
  /** Identifiants d'appui : cote, acte, fait, fragment, mesure, source. */
  appuis: string[];
  ancrage: NiveauAncrage;
};

export type ManqueDeclare = {
  quoi: string;
  necessairePour: string;
  action: string;
};

export type Moteur = {
  type: 'deterministe' | 'local' | 'distant';
  modele: string | null;
  consentementDistant: boolean;
};

export const MOTEUR_DETERMINISTE: Moteur = {
  type: 'deterministe',
  modele: null,
  consentementDistant: false,
};

export type SortiePasse = {
  passe: IdPasse;
  versionSchema: string;
  horodatage: string;
  moteur: Moteur;
  /** Ce que la passe a traité — identifiants, jamais du contenu. */
  traite: string[];
  resultats: EnonceAncre[];
  manques: ManqueDeclare[];
  ecarte: { quoi: string; motif: string }[];
  ouvert: string[];
};

/**
 * Univers des identifiants opposables d'un dossier : tout ce sur quoi un
 * énoncé peut légitimement s'appuyer.
 */
export function identifiantsConnus(dossier: DossierPenal): Set<string> {
  const ids = new Set<string>();
  for (const p of dossier.pieces) {
    ids.add(p.id);
    if (p.cote) ids.add(p.cote);
  }
  for (const e of dossier.evenements) ids.add(e.id);
  for (const f of dossier.faits) ids.add(f.id);
  for (const a of dossier.actes) ids.add(a.id);
  for (const m of dossier.mesures) ids.add(m.id);
  for (const s of dossier.scelles) ids.add(s.id);
  for (const p of dossier.preuves) ids.add(p.id);
  for (const g of dossier.griefs) ids.add(g.id);
  for (const e of dossier.echeances) ids.add(e.id);
  for (const q of dossier.qualificationsEnvisagees) ids.add(q.id);
  return ids;
}

/**
 * Calcule le niveau d'ancrage d'une liste d'appuis contre les identifiants
 * connus. C'est volontairement la SEULE façon d'obtenir un niveau : aucune
 * passe ne le déclare elle-même.
 */
export function calculerAncrage(appuis: string[], connus: Set<string>): NiveauAncrage {
  if (appuis.length === 0) return 'absent';
  const resolus = appuis.filter((a) => connus.has(a));
  if (resolus.length === appuis.length) return 'direct';
  return resolus.length > 0 ? 'partiel' : 'absent';
}

/**
 * Construit une sortie de passe scellée.
 *
 * Chaque énoncé proposé est ancré par calcul ; les énoncés `absent` sont
 * déplacés dans `ecarte` avec le motif — ils n'entrent jamais dans
 * `resultats`, donc jamais dans un affichage ni un livrable (B16).
 */
export function scellerSortie(
  passe: IdPasse,
  dossier: DossierPenal,
  proposes: { enonce: string; appuis: string[] }[],
  options: {
    moteur?: Moteur;
    traite?: string[];
    manques?: ManqueDeclare[];
    ecarte?: { quoi: string; motif: string }[];
    ouvert?: string[];
    horodatage?: string;
    /** Identifiants supplémentaires opposables (sources récupérées, fragments). */
    identifiantsSupplementaires?: Iterable<string>;
  } = {}
): SortiePasse {
  const connus = identifiantsConnus(dossier);
  for (const id of options.identifiantsSupplementaires ?? []) connus.add(id);

  const resultats: EnonceAncre[] = [];
  const ecarte = [...(options.ecarte ?? [])];

  for (const propose of proposes) {
    const ancrage = calculerAncrage(propose.appuis, connus);
    if (ancrage === 'absent') {
      ecarte.push({
        quoi: propose.enonce,
        motif:
          propose.appuis.length === 0
            ? 'Énoncé sans aucun appui : bloqué avant affichage (B16).'
            : `Aucun des appuis cités (${propose.appuis.join(', ')}) n'existe au dossier : bloqué avant affichage (B16).`,
      });
      continue;
    }
    resultats.push({ enonce: propose.enonce, appuis: propose.appuis, ancrage });
  }

  return {
    passe,
    versionSchema: VERSION_SCHEMA,
    horodatage: options.horodatage ?? new Date().toISOString(),
    moteur: options.moteur ?? MOTEUR_DETERMINISTE,
    traite: options.traite ?? [],
    resultats,
    manques: options.manques ?? [],
    ecarte,
    ouvert: options.ouvert ?? [],
  };
}

/**
 * Recalcule l'ancrage d'une sortie, indépendamment de la passe qui l'a
 * produite (§6.4). C'est le contrôle que P6 exécute : toute divergence entre
 * le niveau porté et le niveau recalculé est une anomalie bloquante.
 */
export function verifierAncrage(
  sortie: SortiePasse,
  dossier: DossierPenal,
  identifiantsSupplementaires: Iterable<string> = []
): { conforme: boolean; divergences: string[] } {
  const connus = identifiantsConnus(dossier);
  for (const id of identifiantsSupplementaires) connus.add(id);

  const divergences: string[] = [];
  for (const r of sortie.resultats) {
    const recalcule = calculerAncrage(r.appuis, connus);
    if (recalcule !== r.ancrage) {
      divergences.push(
        `« ${r.enonce.slice(0, 80)} » porte « ${r.ancrage} », recalcul « ${recalcule} ».`
      );
    }
    if (recalcule === 'absent') {
      divergences.push(`« ${r.enonce.slice(0, 80)} » est sans appui résoluble : il n'aurait jamais dû entrer dans les résultats.`);
    }
  }
  return { conforme: divergences.length === 0, divergences };
}

/**
 * Un énoncé « partiel » est affichable mais ne peut pas fonder SEUL un moyen
 * exporté (§6.4) : cette aide départage ce qui peut porter un export.
 */
export function porteUnExport(enonces: EnonceAncre[]): boolean {
  return enonces.some((e) => e.ancrage === 'direct');
}
