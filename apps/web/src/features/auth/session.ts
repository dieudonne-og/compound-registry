import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { can, type Action, type SessionUser } from '@cr/contracts';
import { api, ApiError } from '@/lib/api';

export const sessionKey = ['session'] as const;

export function useSession() {
  const query = useQuery({
    queryKey: sessionKey,
    queryFn: async () => {
      try {
        return (await api<{ user: SessionUser }>('/auth/me')).user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
  });
  return { user: query.data ?? null, isLoading: query.isLoading, error: query.error };
}

export function useCan() {
  const { user } = useSession();
  return (action: Action, resource?: { createdBy: number }) => can(user, action, resource);
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
