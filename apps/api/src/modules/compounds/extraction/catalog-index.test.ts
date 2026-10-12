import { describe, expect, it } from 'vitest';
import { matchCompound } from './catalog-index';

const col = (t: string) => matchCompound(t)?.def.column ?? null;

describe('matchCompound', () => {
  it('matches exact formulas with full confidence', () => {
    expect(matchCompound('Fe2O3')).toMatchObject({
      score: 1,
      fuzzy: false,
      def: { column: 'fe2o3_percent' },
    });
  });
  it('repairs zero/letter-O confusion with a small penalty', () => {
    expect(matchCompound('Si02')).toMatchObject({ score: 0.95, def: { column: 'sio2_percent' } });
    expect(col('U308')).toBe('u3o8_percent');
    expect(col('Nb205')).toBe('nb2o5_percent');
    expect(col('Na20')).toBe('na2o_percent');
  });
  it('accepts lower-case oxide spellings from OCR', () => {
    expect(col('Hfo2')).toBe('hfo2_percent');
    expect(col('P2o5')).toBe('p2o5_percent');
  });
  it('reads AI2O3 as alumina, never the legacy column', () => expect(col('AI2O3')).toBe('al2o3_percent'));
  it('keeps elements and oxides apart', () => {
    expect(col('Zn')).toBe('zn_percent');
    expect(col('ZnO')).toBe('zno_percent');
    expect(col('W')).toBe('wo_percent');
    expect(col('WO3')).toBe('wo3_percent');
  });
  it('has no column for Nb, Y, Zr or Se', () => {
    for (const t of ['Nb', 'Y', 'Zr', 'Se']) expect(matchCompound(t)).toBeNull();
  });
  it('requires correct capitalisation for element symbols', () => {
    expect(matchCompound('as')).toBeNull();
    expect(matchCompound('SN')).toBeNull();
    expect(col('CI')).toBe('cl_percent');
  });
  it('fuzzy-matches long names one edit away, but never across different digits', () => {
    expect(matchCompound('Moistur')).toMatchObject({
      fuzzy: true,
      score: 0.75,
      def: { column: 'moisture_percent' },
    });
    expect(matchCompound('Fe3O3')).toBeNull();
  });
});
