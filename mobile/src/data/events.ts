/** Journal d'activité d'un dossier (lecture seule côté client). */
import { useQuery } from '@tanstack/react-query';
import type { DossierEvent } from '@clairdossier/core';
import { supabase } from '../lib/supabase';
import { qk } from '../lib/query';
import { hasEvents } from './capabilities';

export function useEvents(dossierId: string, userId: string | undefined, limit = 30) {
  return useQuery({
    queryKey: qk.events(dossierId),
    enabled: !!userId && !!dossierId,
    queryFn: async (): Promise<DossierEvent[]> => {
      if (!(await hasEvents())) return [];
      const { data, error } = await supabase
        .from('dossier_events')
        .select('id,dossier_id,user_id,type,label,created_at')
        .eq('dossier_id', dossierId)
        .eq('user_id', userId as string)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as DossierEvent[] | null) ?? [];
    },
  });
}

/** Activité récente TOUS dossiers confondus — fil de l'accueil. */
export function useRecentActivity(userId: string | undefined, limit = 6) {
  return useQuery({
    queryKey: ['events', 'recent'],
    enabled: !!userId,
    queryFn: async (): Promise<DossierEvent[]> => {
      if (!(await hasEvents())) return [];
      const { data, error } = await supabase
        .from('dossier_events')
        .select('id,dossier_id,user_id,type,label,created_at')
        .eq('user_id', userId as string)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data as DossierEvent[] | null) ?? [];
    },
  });
}
