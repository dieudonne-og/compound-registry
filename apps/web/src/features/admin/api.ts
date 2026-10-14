import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActivityEntry,
  ActivityQuery,
  CreateUserInput,
  Page,
  ReferenceItem,
  ReferenceKind,
  TemporaryPasswordResponse,
  UpdateUserInput,
  UserAdminView,
} from '@cr/contracts';
import { api } from '@/lib/api';
import { toQueryString } from '@/features/production/api';

/** Administrators' view of reference data: retired entries included, with usage counts. */
export const useAdminReference = (kind: ReferenceKind) =>
  useQuery({
    queryKey: ['admin', 'reference', kind],
    queryFn: () => api<ReferenceItem[]>(`/reference/${kind}?includeInactive=true`),
  });

export function useSaveReference(kind: ReferenceKind) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: number; name?: string; code?: string; active?: boolean }) =>
      id === undefined
        ? api<ReferenceItem>(`/reference/${kind}`, { method: 'POST', json: body })
        : api<ReferenceItem>(`/reference/${kind}/${id}`, { method: 'PATCH', json: body }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin'] });
      void client.invalidateQueries({ queryKey: ['reference', kind] }); // the lists the production form offers
    },
  });
}

export const useUsers = () =>
  useQuery({ queryKey: ['admin', 'users'], queryFn: () => api<UserAdminView[]>('/users') });

export function useUserMutations() {
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: ['admin'] });
  return {
    create: useMutation({
      mutationFn: (body: CreateUserInput) =>
        api<TemporaryPasswordResponse>('/users', { method: 'POST', json: body }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: UpdateUserInput & { id: number }) =>
        api<UserAdminView>(`/users/${id}`, { method: 'PATCH', json: body }),
      onSuccess: refresh,
    }),
    resetPassword: useMutation({
      mutationFn: (id: number) =>
        api<TemporaryPasswordResponse>(`/users/${id}/reset-password`, { method: 'POST' }),
      onSuccess: refresh,
    }),
  };
}

export const useActivity = (q: Partial<ActivityQuery> & { page: number; pageSize: number }) =>
  useQuery({
    queryKey: ['admin', 'activity', q],
    queryFn: () => api<Page<ActivityEntry>>(`/admin/activity?${toQueryString(q)}`),
    placeholderData: keepPreviousData,
  });
