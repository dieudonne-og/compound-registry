import { describe, expect, it } from 'vitest';
import type { ExtractedField, ExtractionResult } from '@cr/contracts';
import { initialReviewState, reviewGate, toConfirmValues, valueError } from './review-state';

const field = (
  column: ExtractedField['column'],
  value: string | null,
  flags: ExtractedField['flags'] = [],
): ExtractedField => ({
  column,
  label: column,
  value,
  rawText: '',
  confidence: flags.length ? 0.5 : 0.99,
  uncertainty: null,
  flags,
});
const result = (fields: ExtractedField[]) =>
  ({
    extractionId: 'x',
    purchaseId: 'PO-1',
    method: 'ocr',
    pages: 1,
    overallConfidence: 0.9,
    fields,
    unmapped: [],
    warnings: [],
    duplicateOf: null,
    rawText: '',
  }) as ExtractionResult;

describe('review state', () => {
  it('allows confirming when nothing needs attention', () => {
    const r = result([field('sn_percent', '57.5700')]);
    expect(reviewGate(r.fields, initialReviewState(r))).toEqual({
      canConfirm: true,
      pending: [],
      invalid: [],
    });
  });

  it('blocks until flagged fields are accepted or edited', () => {
    const r = result([
      field('sn_percent', '57.5700', ['low_confidence']),
      field('fe_percent', '1.1', ['fuzzy_name']),
    ]);
    const state = initialReviewState(r);
    expect(reviewGate(r.fields, state).pending).toEqual(['sn_percent', 'fe_percent']);
    state.accepted.add('sn_percent');
    state.edited.add('fe_percent');
    expect(reviewGate(r.fields, state).canConfirm).toBe(true);
  });

  it('does not treat a missing marker as a problem', () => {
    const r = result([field('wo_percent', null, ['missing_marker'])]);
    expect(reviewGate(r.fields, initialReviewState(r)).canConfirm).toBe(true);
  });

  it('blocks invalid values even after acceptance', () => {
    const r = result([field('sn_percent', '163.6300', ['out_of_range', 'low_confidence'])]);
    const state = initialReviewState(r);
    state.accepted.add('sn_percent');
    expect(reviewGate(r.fields, state)).toMatchObject({ canConfirm: false, invalid: ['sn_percent'] });
  });

  it('validates individual values', () => {
    expect(valueError('')).toBeNull();
    expect(valueError('57.57')).toBeNull();
    expect(valueError('1.23456')).toMatch(/4 decimal/);
    expect(valueError('abc')).toMatch(/4 decimal/);
  });

  it('sends blanks as null, never zero', () => {
    const r = result([field('sn_percent', '57.5700'), field('wo_percent', null, ['missing_marker'])]);
    const state = initialReviewState(r);
    state.values.fe_percent = '  ';
    expect(toConfirmValues(state)).toEqual({ sn_percent: '57.5700', wo_percent: null, fe_percent: null });
  });
});
