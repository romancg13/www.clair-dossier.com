/**
 * Cache et synchronisation réseau (TanStack Query).
 *
 * Choix : reprise automatique uniquement sur des erreurs vraiment
 * transitoires (réseau, délai, 5xx) — jamais sur un 401/403, qui doit remonter
 * immédiatement à l'utilisateur. Le cache est en mémoire uniquement : aucune
 * donnée de dossier n'est écrite sur le disque de l'appareil (§28/§29).
 */
import { QueryClient } from '@tanstack/react-query';
import { isRetryable } from '@clairdossier/core';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => failureCount < 2 && isRetryable(error),
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      networkMode: 'always',
    },
    mutations: {
      retry: (failureCount, error) => failureCount < 1 && isRetryable(error),
      networkMode: 'always',
    },
  },
});

/** Clés de cache — une seule source, pour invalider sans se tromper. */
export const qk = {
  dossiers: ['dossiers'] as const,
  dossier: (id: string) => ['dossier', id] as const,
  documents: (dossierId: string) => ['documents', dossierId] as const,
  deadlines: (dossierId: string) => ['deadlines', dossierId] as const,
  deadlinesAll: ['deadlines', 'all'] as const,
  events: (dossierId: string) => ['events', dossierId] as const,
  profile: ['profile'] as const,
  entitlements: ['entitlements'] as const,
  capabilities: ['capabilities'] as const,
};
