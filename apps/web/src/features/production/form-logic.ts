import { z } from 'zod';
import { businessToday } from '@/lib/business-day';
import {
  createProductionInput,
  productionCode,
  roundDecimal,
  type CriticalField,
  type ProductionRecord,
  type ReferenceItem,
} from '@cr/contracts';

export const CRITICAL_LABELS: Record<CriticalField, string> = {
  productionCode: 'Production ID',
  tagNumber: 'Tag number',
  weightKg: 'Production weight',
  mineralTypeId: 'Mineral type',
};

export type ProductionFormValues = {
  productionCode: string;
  tagNumber: string;
  productionDate: string;
  mineralTypeId: number | undefined;
  weightKg: string;
  businessLocationId: number | undefined;
  traceabilityAgentId: number | undefined;
  companyId: number | undefined;
  operatorRepresentative: string;
  reason: string;
};

export const toFormValues = (r?: ProductionRecord): ProductionFormValues => ({
  productionCode: r?.productionCode ?? '',
  tagNumber: r?.tagNumber ?? '',
  productionDate: r?.productionDate ?? '',
  mineralTypeId: r?.mineralType.id,
  weightKg: r?.weightKg ?? '',
  businessLocationId: r?.businessLocation.id,
  traceabilityAgentId: r?.traceabilityAgent.id,
  companyId: r?.company.id,
  operatorRepresentative: r?.operatorRepresentative ?? '',
  reason: '',
});

const normalizeWeight = (v: string) =>
  /^\d{1,9}(\.\d{1,3})?$/.test(v.trim()) ? roundDecimal(v.trim(), 3) : v.trim();

export function changedCriticalFields(
  original: ProductionRecord,
  v: Pick<ProductionFormValues, CriticalField>,
): CriticalField[] {
  const before = {
    productionCode: original.productionCode,
    tagNumber: original.tagNumber,
    weightKg: original.weightKg,
    mineralTypeId: original.mineralType.id,
  };
  const after = {
    productionCode: v.productionCode.trim().toUpperCase(),
    tagNumber: v.tagNumber.trim().toUpperCase(),
    weightKg: normalizeWeight(v.weightKg),
    mineralTypeId: v.mineralTypeId,
  };
  return (Object.keys(CRITICAL_LABELS) as CriticalField[]).filter(
    (f) => String(before[f]) !== String(after[f]),
  );
}

/** Mirrors the server rules so most mistakes are caught before submitting; the server re-validates everything. */
export function productionFormSchema(original?: ProductionRecord, today = businessToday()) {
  const base = createProductionInput.omit({ productionCode: true }).extend({
    productionCode: original ? productionCode : z.string().optional(),
    productionDate: createProductionInput.shape.productionDate.refine(
      (d) => d <= today,
      'Production date cannot be in the future.',
    ),
    reason: z.string().trim().max(500).optional(),
  });
  return base.superRefine((v, ctx) => {
    if (!original) return;
    const changed = changedCriticalFields(original, {
      ...v,
      productionCode: v.productionCode ?? '',
    } as ProductionFormValues);
    if (changed.length && (v.reason?.length ?? 0) < 5) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Explain why these values changed (at least 5 characters).',
      });
    }
  });
}

/** Select options from active reference items, plus the record's current item if it has since been retired. */
export function optionsWithCurrent(
  items: ReferenceItem[] | undefined,
  current?: { id: number; name: string },
) {
  const options = (items ?? []).map((i) => ({ value: i.id, label: i.name, hint: i.code }));
  if (current && !options.some((o) => o.value === current.id)) {
    options.push({ value: current.id, label: `${current.name} (retired)`, hint: null });
  }
  return options;
}
