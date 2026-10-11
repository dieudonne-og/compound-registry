import { describe, expect, it } from 'vitest';
import { createProductionInput, updateProductionInput } from './production';

const valid = {
  tagNumber: ' t-0045 ',
  productionDate: '2026-10-10',
  mineralTypeId: 1,
  weightKg: '320.3',
  businessLocationId: 1,
  traceabilityAgentId: 1,
  companyId: 1,
  operatorRepresentative: 'Jean Mugabo',
};

describe('production schemas', () => {
  it('trims and upper-cases the tag number', () => {
    expect(createProductionInput.parse(valid).tagNumber).toBe('T-0045');
  });
  it('rejects impossible dates', () => {
    expect(createProductionInput.safeParse({ ...valid, productionDate: '2026-02-30' }).success).toBe(false);
  });
  it('requires a version on update and accepts an optional reason', () => {
    expect(updateProductionInput.safeParse({ ...valid, productionCode: 'PRD-2026-000001' }).success).toBe(
      false,
    );
    expect(
      updateProductionInput.safeParse({ ...valid, productionCode: 'PRD-2026-000001', version: 1 }).success,
    ).toBe(true);
  });
});
