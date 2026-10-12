import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import {
  can,
  DEFAULT_PREFERENCES,
  type Action,
  type MeResponse,
  type PreferencesPatch,
  type UserPreferences,
} from '@cr/contracts';
import { api, ApiError } from '@/lib/api';

export const sessionKey = ['session'] as const;

/** The signed-in session, or null when nobody is signed in. */
export async function fetchSession(): Promise<MeResponse | null> {
  try {
    return await api<MeResponse>('/auth/me');
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null;
    throw e;
  }
}

export function useSession() {
  const query = useQuery({ queryKey: sessionKey, queryFn: fetchSession, staleTime: 5 * 60_000 });
  const me = query.data ?? null;
  return {
    user: me?.user ?? null,
    mustChangePassword: me?.mustChangePassword ?? false,
    preferences: me?.preferences ?? DEFAULT_PREFERENCES,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useCan() {
  const { user } = useSession();
  return (action: Action, resource?: { createdBy: number }) => can(user, action, resource);
}

/** Preferences of the signed-in user; `update` saves to the account (a no-op when signed out). */
export function usePreferences() {
  const client = useQueryClient();
  const { user, preferences } = useSession();
  const patchCache = (fn: (p: UserPreferences) => UserPreferences) =>
    client.setQueryData<MeResponse | null>(sessionKey, (me) =>
      me ? { ...me, preferences: fn(me.preferences) } : me,
    );
  const mutation = useMutation({
    mutationFn: (patch: PreferencesPatch) =>
      api<UserPreferences>('/me/preferences', { method: 'PUT', json: patch }),
    onMutate: (patch) => {
      const before = client.getQueryData<MeResponse | null>(sessionKey);
      patchCache((p) => ({ ...p, ...patch }));
      return { before };
    },
    onError: (_err, _patch, ctx) => client.setQueryData(sessionKey, ctx?.before),
    onSuccess: (saved) => patchCache(() => saved),
  });
  const { mutateAsync } = mutation;
  const update = useCallback(
    async (patch: PreferencesPatch) => {
      if (user) await mutateAsync(patch);
    },
    [user, mutateAsync],
  );
  return { preferences, update, saving: mutation.isPending };
}

export function useSignOut() {
  const client = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSettled: () => {
      client.clear();
      client.setQueryData(sessionKey, null);
      navigate('/login', { replace: true });
    },
  });
}
