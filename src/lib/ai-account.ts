import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

/**
 * Analyse automatique par compte (migration 20261128120000) : acceptation unique,
 * désactivable dans Mon compte, derrière un interrupteur général côté serveur.
 * Si la migration est absente ou l'interrupteur fermé pour ce compte, rien ne s'affiche.
 */

export { AI_ACCOUNT_TERMS_VERSION, aiAccountError, parseAiAccount, shouldAskAiConsent, type AiAccountStatus } from './ai-account-model';
import { AI_ACCOUNT_TERMS_VERSION, aiAccountError, parseAiAccount, type AiAccountStatus } from './ai-account-model';

export function useAiAccount(userId: string | null | undefined) {
  const [status, setStatus] = useState<AiAccountStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) {
      setStatus(null);
      return;
    }
    const { data, error: e } = await supabase.rpc('my_ai_account');
    // Migration absente ou erreur réseau : on n'affiche rien plutôt qu'un état faux.
    setStatus(e ? null : parseAiAccount(data));
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(
    async (call: () => PromiseLike<{ error: { message: string } | null }>) => {
      setPending(true);
      setError(null);
      const { error: e } = await call();
      if (e) setError(aiAccountError(e.message));
      await reload();
      setPending(false);
      return !e;
    },
    [reload],
  );

  const accept = useCallback(
    () => run(() => supabase.rpc('accept_ai_account', { p_terms_version: AI_ACCOUNT_TERMS_VERSION })),
    [run],
  );
  const disable = useCallback(() => run(() => supabase.rpc('disable_ai_account')), [run]);

  return { status, pending, error, accept, disable, reload };
}
