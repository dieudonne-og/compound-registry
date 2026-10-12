import { describe, expect, it } from 'vitest';
import { parseLines } from './parser';
import { votedLines } from './vote';

const run = (...lines: [string, number][]) =>
  parseLines(lines.map(([text, confidence]) => ({ text, confidence })));

describe('votedLines', () => {
  it('keeps the value with the most confidence across runs, using its original line', () => {
    const lines = votedLines([
      run(['Nb205 25.79', 0.8]),
      run(['Nb205 25.0', 0.9]),
      run(['Nb2O5 25.79', 0.4]),
    ]);
    const result = parseLines(lines);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]).toMatchObject({
      column: 'nb2o5_percent',
      value: '25.7900',
      rawText: 'Nb205 25.79',
    });
  });

  it('unions values that only some runs recognised', () => {
    const result = parseLines(votedLines([run(['Mn 6.07', 0.9]), run(['As 0.270', 0.9], ['Se 0.112', 0.7])]));
    expect(result.fields.map((f) => f.column)).toEqual(['mn_percent', 'as_percent']);
    expect(result.unmapped.map((u) => u.label)).toEqual(['Se']);
  });

  it('keeps a value seen by a single weak run flagged for review', () => {
    const result = parseLines(votedLines([run(['Ta205 27.43', 0.5]), run(['Mn 6.07', 0.95])]));
    expect(result.fields.find((f) => f.column === 'ta2o5_percent')?.flags).toContain('low_confidence');
  });
});
