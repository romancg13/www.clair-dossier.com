/** Profil professionnel (table `profiles`) — lecture et mise à jour. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { qk } from '../lib/query';

export type Profile = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  company_type: string | null;
  phone: string | null;
};

export const COMPANY_TYPES: { id: string; label: string }[] = [
  { id: 'artisan', label: 'Artisan' },
  { id: 'entreprise-individuelle', label: 'Entreprise individuelle' },
  { id: 'profession-liberale', label: 'Profession libérale' },
  { id: 'pme', label: 'PME' },
  { id: 'particulier', label: 'Particulier' },
  { id: 'autre', label: 'Autre' },
];

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: qk.profile,
    enabled: !!userId,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,full_name,company_name,company_type,phone')
        .eq('id', userId as string)
        .maybeSingle();
      if (error) throw error;
      return (data as Profile | null) ?? null;
    },
  });
}

export function useSaveProfile(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<Profile, 'id'>>) => {
      // upsert : le profil est normalement créé par déclencheur à l'inscription,
      // mais un compte ancien peut ne pas en avoir.
      const { error } = await supabase.from('profiles').upsert({ id: userId, ...patch });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.profile });
    },
  });
}
