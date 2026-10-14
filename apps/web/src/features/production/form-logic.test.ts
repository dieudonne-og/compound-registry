import { describe, expect, it } from 'vitest';
import type { ProductionRecord } from '@cr/contracts';
import { changedCriticalFields, optionsWithCurrent, productionFormSchema, toFormValues } from './form-logic';

const record: ProductionRecord = {
  id: 1,
  productionCode: 'PRD-2026-000001',
  tagNumber: 'T-0045',
  productionDate: '2026-10-01',
  weightKg: '320.300',
  mineralType: { id: 1, code: 'SN', name: 'Cassiterite' },
  businessLocation: { id: 1, name: 'A' },
  traceabilityAgent: { id: 1, name: 'B' },
  company: { id: 1, name: 'C' },
  operatorRepresentative: 'Jean Mugabo',
  version: 3,
  createdBy: { id: 1, name: 'X' },
  createdAt: '2026-10-01T00:00:00Z',
  updatedBy: null,
  updatedAt: '2026-10-01T00:00:00Z',
};

describe('production form logic', () => {
  it('ignores formatting-only differences in critical fields', () => {
    expect(
      changedCriticalFields(record, { ...toFormValues(record), weightKg: '320.3', tagNumber: ' t-0045 ' }),
    ).toEqual([]);
  });

  it('lists changed critical fields', () => {
    expect(
      changedCriticalFields(record, { ...toFormValues(record), weightKg: '318.5', mineralTypeId: 2 }),
    ).toEqual(['weightKg', 'mineralTypeId']);
  });

  it('requires a reason only when a critical field changes', () => {
    const schema = productionFormSchema(record, '2026-10-11');
    expect(
      schema.safeParse({ ...toFormValues(record), operatorRepresentative: 'Someone Else' }).success,
    ).toBe(true);
    const r = schema.safeParse({ ...toFormValues(record), weightKg: '318.5' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({ path: ['reason'] });
    expect(
      schema.safeParse({ ...toFormValues(record), weightKg: '318.5', reason: 'Re-weighed' }).success,
    ).toBe(true);
  });

  it('rejects future production dates', () => {
    const r = productionFormSchema(undefined, '2026-10-11').safeParse({
      ...toFormValues(record),
      productionDate: '2026-10-12',
    });
    expect(r.error?.issues.map((i) => i.path[0])).toContain('productionDate');
  });

  it('keeps a retired reference selectable for records that already use it', () => {
    const active = [{ id: 1, name: 'Akagera Minerals Ltd', code: null, active: true, usageCount: 0 }];
    expect(optionsWithCurrent(active, { id: 9, name: 'Old Co' })).toEqual([
      { value: 1, label: 'Akagera Minerals Ltd', hint: null },
      { value: 9, label: 'Old Co (retired)', hint: null },
    ]);
    expect(optionsWithCurrent(active, { id: 1, name: 'Akagera Minerals Ltd' })).toHaveLength(1);
  });
});
