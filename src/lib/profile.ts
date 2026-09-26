import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { effectiveBillingEmail } from '../../packages/core/src/index';

/**
 * Profil de l'utilisateur connecté.
 *
 * `extended` indique si les colonnes de la migration 20260917120000
 * (prénom, nom, e-mail de facturation) existent : avant son application,
 * seules les colonnes historiques sont lues et rien n'est cassé.
 */
export type MyProfile = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  company_type: string | null;
  phone: string | null;
  billing_email: string | null;
};

const EXTENDED = 'id,full_name,first_name,last_name,company_name,company_type,phone,billing_email';
const LEGACY = 'id,full_name,company_name,company_type,phone';

export function useMyProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [extended, setExtended] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const ext = await supabase.from('profiles').select(EXTENDED).eq('id', userId).maybeSingle();
    if (!ext.error) {
      setExtended(true);
      setProfile((ext.data as MyProfile | null) ?? null);
    } else {
      const legacy = await supabase.from('profiles').select(LEGACY).eq('id', userId).maybeSingle();
      setExtended(false);
      const row = legacy.data as Omit<MyProfile, 'first_name' | 'last_name' | 'billing_email'> | null;
      setProfile(row ? { ...row, first_name: null, last_name: null, billing_email: null } : null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { profile, extended, loading, reload };
}

/* ── E-mail prérempli au paiement (facultatif, repli sur le compte) ────── */

const billingCache = new Map<string, Promise<string | null>>();

async function loadBillingEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('billing_email').eq('id', userId).maybeSingle();
  if (error) return null;
  return (data as { billing_email: string | null } | null)?.billing_email ?? null;
}

export function useCheckoutEmail(userId: string | undefined, accountEmail: string | null): string | null {
  const [billing, setBilling] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    if (!billingCache.has(userId)) billingCache.set(userId, loadBillingEmail(userId));
    void billingCache.get(userId)!.then((v) => {
      if (active) setBilling(v);
    });
    return () => {
      active = false;
    };
  }, [userId]);
  return effectiveBillingEmail(billing, accountEmail);
}
