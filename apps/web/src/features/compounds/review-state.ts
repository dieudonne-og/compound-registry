import { percentValue, type CompoundColumn, type ExtractedField, type ExtractionResult } from '@cr/contracts';

export type ReviewState = {
  purchaseId: string;
  values: Partial<Record<CompoundColumn, string>>;
  accepted: Set<CompoundColumn>;
  edited: Set<CompoundColumn>;
};

export const needsAttention = (f: ExtractedField) => f.flags.some((flag) => flag !== 'missing_marker');

export function initialReviewState(result: ExtractionResult): ReviewState {
  return {
    purchaseId: result.purchaseId,
    values: Object.fromEntries(result.fields.map((f) => [f.column, f.value ?? ''])),
    accepted: new Set(),
    edited: new Set(),
  };
}

export function valueError(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const r = percentValue.safeParse(value);
  return r.success ? null : r.error.issues[0]!.message;
}

export function reviewGate(fields: ExtractedField[], state: ReviewState) {
  const pending = fields
    .filter((f) => needsAttention(f) && !state.accepted.has(f.column) && !state.edited.has(f.column))
    .map((f) => f.column);
  const invalid = (Object.keys(state.values) as CompoundColumn[]).filter((c) => valueError(state.values[c]));
  return { canConfirm: pending.length === 0 && invalid.length === 0, pending, invalid };
}

export function toConfirmValues(state: ReviewState): Record<CompoundColumn, string | null> {
  return Object.fromEntries(
    (Object.entries(state.values) as [CompoundColumn, string | undefined][]).map(([c, v]) => [
      c,
      v?.trim() ? v.trim() : null,
    ]),
  ) as Record<CompoundColumn, string | null>;
}
