import { describe, expect, it } from 'vitest';
import { formatDate, formatKg, formatPercent, shortHash } from './format';

const spaces = (s: string) => s.replace(/[\u202F\u00A0]/g, ' ');

describe('format', () => {
  it('formats weights per locale', () => {
    expect(formatKg('1248.900', 'en-GB')).toBe('1,248.900 kg');
    expect(spaces(formatKg('1248.900', 'fr-FR'))).toBe('1 248,900 kg');
  });
  it('formats percentages per locale without trailing zeros, and blanks as a dash', () => {
    expect(formatPercent('57.5700', 'en-GB')).toBe('57.57 %');
    expect(formatPercent('0.0060', 'en-GB')).toBe('0.006 %');
    expect(spaces(formatPercent('57.5700', 'fr-FR'))).toBe('57,57 %');
    expect(formatPercent(null, 'fr-FR')).toBe('—');
  });
  it('formats calendar dates per locale, or as ISO, without time-zone shifts', () => {
    expect(formatDate('2026-10-01', 'en-GB')).toBe('1 Oct 2026');
    expect(formatDate('2026-10-01', 'fr-FR')).toBe('1 oct. 2026');
    expect(formatDate('2026-10-01', 'fr-FR', 'iso')).toBe('2026-10-01');
  });
  it('shortens hashes', () => expect(shortHash('a'.repeat(60) + 'bcde')).toBe('aaaaaaaa…bcde'));
});
