import type { ParseResult, TextLine } from './parser';

type Candidate = { score: number; best: { text: string; confidence: number } };

/**
 * Merges several OCR runs of the same image. For each compound (or unmapped element) the value
 * with the highest summed confidence wins, and the line it was read from is kept so the parser
 * reproduces it with its original source text. Values seen by only one weak run stay low-confidence.
 */
export function votedLines(runs: ParseResult[]): TextLine[] {
  const byKey = new Map<string, Map<string, Candidate>>();
  const add = (key: string, value: string | null, text: string, confidence: number) => {
    const values = byKey.get(key) ?? new Map<string, Candidate>();
    const candidate = values.get(value ?? '') ?? { score: 0, best: { text, confidence } };
    candidate.score += confidence;
    if (confidence > candidate.best.confidence) candidate.best = { text, confidence };
    values.set(value ?? '', candidate);
    byKey.set(key, values);
  };

  for (const run of runs) {
    for (const f of run.fields) add(`field:${f.column}`, f.value, f.rawText, f.confidence);
    for (const u of run.unmapped) add(`unmapped:${u.label}`, u.value, u.rawText, 1);
  }

  const lines = new Map<string, TextLine>();
  for (const values of byKey.values()) {
    const winner = [...values.values()].sort((a, b) => b.score - a.score)[0]!;
    const existing = lines.get(winner.best.text);
    if (!existing || existing.confidence < winner.best.confidence) lines.set(winner.best.text, winner.best);
  }
  return [...lines.values()];
}
