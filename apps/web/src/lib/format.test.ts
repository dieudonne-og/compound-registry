import { describe, expect, it } from 'vitest';
import { formatDate, formatKg, formatPercent, shortHash } from './format';

describe('format', () => {
  it('formats weights with grouping and three decimals', () =>
    expect(formatKg('1250.500')).toBe('1,250.500 kg'));
  it('formats percentages without trailing zeros, and blanks as a dash', () => {
    expect(formatPercent('57.5700')).toBe('57.57 %');
    expect(formatPercent('0.0060')).toBe('0.006 %');
    expect(formatPercent(null)).toBe('—');
  });
  it('formats calendar dates without time-zone shifts', () =>
    expect(formatDate('2026-10-01')).toBe('1 Oct 2026'));
  it('shortens hashes', () => expect(shortHash('a'.repeat(60) + 'bcde')).toBe('aaaaaaaa…bcde'));
});
