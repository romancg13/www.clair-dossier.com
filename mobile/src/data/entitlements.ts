/**
 * Droits et abonnement — LECTURE SEULE d'une source serveur.
 *
 * État actuel du produit (voir /etat-du-produit) : les abonnements Stripe
 * fonctionnent par liens de paiement hébergés et le rapprochement est fait
 * manuellement par l'équipe ; il n'existe ni webhook ni table d'abonnements.
 * L'application n'invente donc AUCUN droit : tant que le serveur ne publie
 * rien, l'état reste « inconnu » et rien n'est verrouillé côté client.
 *
 * Le jour où un endpoint serveur publiera les droits (Stripe, Apple ou Google,
 * peu importe), il suffira de le brancher ici : le reste de l'application
 * parle déjà au contrat `EntitlementsState` de packages/core.
 */
import { useQuery } from '@tanstack/react-query';
import { UNKNOWN_ENTITLEMENTS, parseEntitlements, type EntitlementsState } from '@clairdossier/core';
import { supabase } from '../lib/supabase';
import { qk } from '../lib/query';

/**
 * Source serveur attendue : une vue/table `entitlements` filtrée par RLS sur
 * `user_id`. Absente aujourd'hui → l'état reste « inconnu », sans erreur.
 */
async function fetchEntitlements(userId: string): Promise<EntitlementsState> {
  try {
    const { data, error } = await supabase
      .from('entitlements')
      .select('plan,status,source,current_period_end,limits,features')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return UNKNOWN_ENTITLEMENTS;
    return parseEntitlements(data);
  } catch {
    return UNKNOWN_ENTITLEMENTS;
  }
}

export function useEntitlements(userId: string | undefined) {
  return useQuery({
    queryKey: qk.entitlements,
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: () => fetchEntitlements(userId as string),
  });
}
