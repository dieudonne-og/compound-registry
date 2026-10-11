import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompoundColumn, CompoundDetail, CompoundSummary, Page } from '@cr/contracts';
import { api } from '@/lib/api';

export type CompoundQuery = {
  page: number;
  pageSize: number;
  purchaseId?: string;
  from?: string;
  to?: string;
};

const qs = (q: Record<string, string | number | undefined>) =>
  new URLSearchParams(
    Object.entries(q)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

export const useCompounds = (q: CompoundQuery) =>
  useQuery({
    queryKey: ['compounds', q],
    queryFn: () => api<Page<CompoundSummary>>(`/compounds?${qs(q)}`),
    placeholderData: keepPreviousData,
  });

export const useCompound = (id: number) =>
  useQuery({ queryKey: ['compounds', id], queryFn: () => api<CompoundDetail>(`/compounds/${id}`) });

export function useConfirmCompound() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      extractionId: string;
      purchaseId: string;
      values: Record<CompoundColumn, string | null>;
    }) => api<{ id: number }>('/compounds', { method: 'POST', json: body }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['compounds'] }),
  });
}
