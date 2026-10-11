import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuditEventView,
  Page,
  ProductionRecord,
  ReferenceItem,
  ReferenceKind,
  VerifyResult,
} from '@cr/contracts';
import { api } from '@/lib/api';
import type { ProductionFormValues } from './form-logic';

export type ProductionQuery = Record<string, string | number | undefined>;
export const toQueryString = (q: ProductionQuery) =>
  new URLSearchParams(
    Object.entries(q)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

export const useReference = (kind: ReferenceKind) =>
  useQuery({
    queryKey: ['reference', kind],
    queryFn: () => api<ReferenceItem[]>(`/reference/${kind}`),
    staleTime: 10 * 60_000,
  });

export const useProductionList = (q: ProductionQuery) =>
  useQuery({
    queryKey: ['production', 'list', q],
    queryFn: () => api<Page<ProductionRecord>>(`/production?${toQueryString(q)}`),
    placeholderData: keepPreviousData,
  });

export const useProduction = (id: number, enabled = true) =>
  useQuery({
    queryKey: ['production', id],
    queryFn: () => api<ProductionRecord>(`/production/${id}`),
    enabled,
  });

export const useHistory = (id: number, enabled: boolean) =>
  useQuery({
    queryKey: ['production', id, 'history'],
    queryFn: () => api<AuditEventView[]>(`/production/${id}/history`),
    enabled,
  });

export const useVerify = (id: number) =>
  useQuery({
    queryKey: ['production', id, 'verify'],
    queryFn: () => api<VerifyResult>(`/production/${id}/verify`),
    enabled: false,
    retry: false,
    gcTime: 0,
  });

const payload = (v: ProductionFormValues) => ({
  tagNumber: v.tagNumber,
  productionDate: v.productionDate,
  mineralTypeId: v.mineralTypeId,
  weightKg: v.weightKg,
  businessLocationId: v.businessLocationId,
  traceabilityAgentId: v.traceabilityAgentId,
  companyId: v.companyId,
  operatorRepresentative: v.operatorRepresentative,
});

export function useSaveProduction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      original,
      values,
      idempotencyKey,
    }: {
      original?: ProductionRecord;
      values: ProductionFormValues;
      idempotencyKey: string;
    }) =>
      original
        ? api<ProductionRecord>(`/production/${original.id}`, {
            method: 'PUT',
            json: {
              ...payload(values),
              productionCode: values.productionCode,
              version: original.version,
              reason: values.reason || undefined,
            },
          })
        : api<ProductionRecord>('/production', {
            method: 'POST',
            json: payload(values),
            headers: { 'Idempotency-Key': idempotencyKey },
          }),
    onSuccess: (record) => {
      client.setQueryData(['production', record.id], record);
      void client.invalidateQueries({ queryKey: ['production', 'list'] });
      void client.invalidateQueries({ queryKey: ['production', record.id, 'history'] });
      void client.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
