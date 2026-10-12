import { describe, expect, it } from 'vitest';
import { parseTsv } from './ocr';

const tsv = [
  'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
  '5\t1\t1\t1\t1\t1\t0\t0\t10\t10\t96\tSn',
  '5\t1\t1\t1\t1\t2\t0\t0\t10\t10\t90\t=',
  '5\t1\t1\t1\t1\t3\t0\t0\t10\t10\t84\t57.57',
  '4\t1\t1\t1\t2\t0\t0\t0\t10\t10\t-1\t',
  '5\t1\t1\t1\t2\t1\t0\t0\t10\t10\t50\tFe',
].join('\n');

describe('parseTsv', () => {
  it('groups words into lines with mean confidence', () => {
    expect(parseTsv(tsv)).toEqual([
      { text: 'Sn = 57.57', confidence: 0.9 },
      { text: 'Fe', confidence: 0.5 },
    ]);
  });
});
