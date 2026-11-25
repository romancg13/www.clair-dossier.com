// Client de l'API de recette (même origine, cookie de session httpOnly).
import type { RenduView } from '../../supabase/functions/_shared/rendus/view';

export type { RenduView };

export class ApiError extends Error {
  constructor(public status: number, message: string, public redirect?: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = { 'x-clairdossier': '1' };
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(init.body);
  }
  const r = await fetch(path, { method: init.method ?? (body ? 'POST' : 'GET'), headers, body, credentials: 'same-origin' });
  const data = (await r.json().catch(() => ({}))) as T & { error?: string; redirect?: string };
  if (!r.ok) throw new ApiError(r.status, data.error ?? 'Le service ne répond pas. Réessayez dans un instant.', data.redirect);
  return data;
}

export interface Moi {
  user: { id: string; email: string; prenom: string; nom: string; societe: string | null; role: 'client' | 'admin'; demo: boolean } | null;
  abonnement?: { active: boolean; status: string; plan_id: string | null; plan_name: string | null; period_end: string | null; cancel_at_period_end: boolean; dossier_limit: number | null };
  ia?: string;
}

export interface DossierListe {
  id: string;
  titre: string;
  objectif: string | null;
  cree_le: string;
  etat: Etat;
  travaux: number;
  pieces: number;
  revision: number | null;
  action: string | null;
}
export type Etat = 'vide' | 'en_cours' | 'pret' | 'en_verification' | 'cloture' | 'incident';

export interface DossierDetail {
  dossier: { id: string; titre: string; objectif: string | null; cree_le: string; cloture: boolean };
  statut: { etat: Etat; travaux: number; pieces: number; revision: number | null };
  abonnement: NonNullable<Moi['abonnement']>;
  vue: RenduView | null;
  en_verification: boolean;
  pieces: { id: string; nom: string; taille: number; deposee_le: string; doublon_de: string | null; lecture: { statut: 'ok' | 'unsupported' | 'error'; motif: string | null; report: boolean; moteur: string } | null }[];
  rendus: { cle: string; libelle: string; revision: number | null; statut: string | null; fichiers: { nom: string; taille: number }[]; versions: number }[];
  echeances: unknown[];
  historique: { id: string; type: string; label: string; created_at: string }[];
}

export const ETAT_LABEL: Record<Etat, string> = {
  vide: 'En attente de vos pièces',
  en_cours: 'Lecture en cours',
  pret: 'Résultats disponibles',
  en_verification: 'En vérification',
  cloture: 'Clôturé',
  incident: 'Lecture interrompue',
};

export const frDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).replace(/^1 /, '1er ');
};
