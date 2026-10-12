import { describe, expect, it } from 'vitest';
import { COMPOUND_CATALOG, COMPOUND_COLUMNS, ELEMENT_SYMBOLS } from './catalog';

describe('compound catalog', () => {
  it('lists the 50 percent columns of the Compound table in schema order', () => {
    expect(COMPOUND_COLUMNS).toHaveLength(50);
    expect(COMPOUND_COLUMNS[0]).toBe('sn_percent');
    expect(COMPOUND_COLUMNS.at(-1)).toBe('ni_percent');
    expect(COMPOUND_CATALOG.map((d) => d.column)).toEqual(COMPOUND_COLUMNS);
  });

  it('never maps the same alias to two columns', () => {
    const key = (a: string) => a.normalize('NFKC').replace(/0/g, 'O').toLowerCase();
    const seen = new Map<string, string>();
    for (const def of COMPOUND_CATALOG) {
      for (const alias of def.aliases) {
        expect(seen.get(key(alias)), `${alias} in ${def.column}`).toBeUndefined();
        seen.set(key(alias), def.column);
      }
    }
  });

  it('keeps unclear columns out of automatic filling', () => {
    const manual = COMPOUND_CATALOG.filter((d) => !d.autoFill).map((d) => d.column);
    expect(manual.sort()).toEqual([
      'ai2o3_percent',
      'bal_percent',
      'hso2_percent',
      'i_percent',
      'ph_percent',
    ]);
  });

  it('knows element symbols without columns', () => {
    for (const s of ['Nb', 'Y', 'Zr', 'Se', 'Pt', 'Au']) expect(ELEMENT_SYMBOLS.has(s)).toBe(true);
    expect(ELEMENT_SYMBOLS.has('Xx')).toBe(false);
  });
});
