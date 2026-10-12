import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('quotes commas, quotes and new lines', () => {
    expect(toCsv([['a,b', 'say "hi"', 'x\ny', 5, null]])).toBe('\uFEFF"a,b","say ""hi""","x\ny",5,\r\n');
  });
  it('neutralises spreadsheet formulas', () => {
    expect(toCsv([['=HYPERLINK("http://x")', '+1', '-2', '@SUM(A1)']])).toBe(
      `\uFEFF"'=HYPERLINK(""http://x"")",'+1,'-2,'@SUM(A1)\r\n`,
    );
  });
});
