import { describe, expect, it } from 'vitest';
import { percentValue, roundDecimal, weightKgValue } from './decimal';

describe('roundDecimal', () => {
  it.each([
    ['57.57', 4, '57.5700'],
    ['0.067', 4, '0.0670'],
    ['12.34565', 4, '12.3457'],
    ['12.34564', 4, '12.3456'],
    ['99.99995', 4, '100.0000'],
    ['320.3', 3, '320.300'],
    ['5', 3, '5.000'],
  ])('rounds %s to %i places as %s', (v, s, out) => expect(roundDecimal(v, s)).toBe(out));
});

describe('percentValue', () => {
  it('accepts 0–100 with up to 4 decimals', () => {
    for (const v of ['0', '57.57', '100', '0.0001']) expect(percentValue.safeParse(v).success).toBe(true);
  });
  it('rejects out-of-range, too precise and non-numeric values', () => {
    for (const v of ['100.0001', '12.34567', '-1', 'abc', '', '1e2'])
      expect(percentValue.safeParse(v).success).toBe(false);
  });
});

describe('weightKgValue', () => {
  it('accepts positive values with up to 3 decimals', () => {
    for (const v of ['320.3', '0.001', '999999999.999'])
      expect(weightKgValue.safeParse(v).success).toBe(true);
  });
  it('rejects zero, too many decimals and too many digits', () => {
    for (const v of ['0', '0.000', '0.0001', '1000000000', '-5', '12,5'])
      expect(weightKgValue.safeParse(v).success).toBe(false);
  });
});
