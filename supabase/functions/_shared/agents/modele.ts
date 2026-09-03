/**
 * Accès aux modèles de langage : interface fermée, implémentations serveur.
 * La clé d'API n'existe que dans l'environnement des Edge Functions ; aucun code
 * client n'importe ce module. Les sorties structurées passent par un outil forcé
 * (`tool_choice`) dont le schéma d'entrée est celui de l'agent : le modèle ne
 * renvoie pas de texte libre.
 */

export type RequeteModele = {
  modele: string;
  systeme: string;
  utilisateur: string;
  /** Nom de l'outil forcé et schéma JSON de son entrée. */
  outil: { nom: string; description: string; schema: Record<string, unknown> };
  max_tokens?: number;
  temperature?: number;
  timeout_ms?: number;
};

export type ReponseModele = {
  modele: string;
  /** Entrée de l'outil telle que renvoyée par le modèle (non validée). */
  sortie: unknown;
  tokens_entree: number;
  tokens_sortie: number;
  arret: string | null;
};

export interface FournisseurModele {
  nom: string;
  completer(requete: RequeteModele): Promise<ReponseModele>;
}

/** Modèles par tâche (PARTIE 0.2). Surchargeables par variable d'environnement côté serveur. */
export const MODELES = {
  extraction: "claude-sonnet-5",
  classification: "claude-haiku-4-5-20251001",
  raisonnement: "claude-opus-5",
  /** Contrôle de sens RGPD (ECHO) : nécessité d'une donnée au regard de la finalité — pas une classification simple. */
  conformite: "claude-sonnet-5",
} as const;

/** Premier fournisseur explicitement fourni (null compris) ; sinon null. */
export function choisirModele(...candidats: (FournisseurModele | null | undefined)[]): FournisseurModele | null {
  for (const c of candidats) if (c !== undefined) return c;
  return null;
}

export class ErreurModele extends Error {
  constructor(message: string, public readonly statut?: number, public readonly reessayable = false) {
    super(message);
    this.name = "ErreurModele";
  }
}

/**
 * Simulateur pour les tests : renvoie des sorties préparées, dans l'ordre, et
 * mémorise les requêtes reçues. Aucun appel réseau.
 */
export function modeleSimule(reponses: unknown[], options: { nom?: string; tokens?: [number, number] } = {}): FournisseurModele & {
  requetes: RequeteModele[];
} {
  const file = [...reponses];
  const requetes: RequeteModele[] = [];
  return {
    nom: options.nom ?? "simule",
    requetes,
    async completer(requete) {
      requetes.push(requete);
      if (file.length === 0) throw new ErreurModele("simulateur : aucune réponse préparée", undefined, false);
      const sortie = file.shift();
      if (sortie instanceof Error) throw sortie;
      return {
        modele: requete.modele,
        sortie,
        tokens_entree: options.tokens?.[0] ?? 1000,
        tokens_sortie: options.tokens?.[1] ?? 300,
        arret: "tool_use",
      };
    },
  };
}
