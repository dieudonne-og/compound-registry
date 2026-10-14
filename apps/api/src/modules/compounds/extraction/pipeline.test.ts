import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COMPOUND_COLUMNS } from '@cr/contracts';
import { extractReport } from './pipeline';
import type { AcceptedMime } from './intake';

const dir = new URL('../../../../test/fixtures/reports/', import.meta.url);
type Expected = {
  file: string;
  mime: AcceptedMime;
  method: string;
  values: Record<string, string>;
  missing: string[];
  unmapped: string[];
};
const cases = readdirSync(dir)
  .filter((f) => f.endsWith('.expected.json'))
  .map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as Expected);

describe.each(cases)('sample report $file', (expected) => {
  it('extracts every value into the right column', async () => {
    const outcome = await extractReport(readFileSync(new URL(expected.file, dir)), expected.mime, 'eng+fra');
    expect(outcome.method).toBe(expected.method);

    const byColumn = new Map(outcome.fields.map((f) => [f.column, f]));
    for (const column of COMPOUND_COLUMNS) {
      const field = byColumn.get(column);
      if (column in expected.values) {
        expect(field?.value, column).toBe(expected.values[column]);
      } else if (expected.missing.includes(column)) {
        expect(field, column).toMatchObject({
          value: null,
          flags: expect.arrayContaining(['missing_marker']),
        });
      } else if (field) {
        // Anything not on the report (stamps, seals, noise) must at least be flagged for review.
        expect(field.flags, `unexpected ${column}=${field.value}`).toContain('low_confidence');
      }
    }
    expect(outcome.unmapped.map((u) => u.label)).toEqual(expect.arrayContaining(expected.unmapped));
  }, 120_000);
});

describe('extraction time budget', () => {
  it('stops with a clear reason instead of running past the deadline', async () => {
    const photo = readFileSync(new URL('xrf-screen-photo.jpg', dir));
    await expect(
      extractReport(photo, 'image/jpeg', 'eng+fra', { deadline: Date.now() - 1 }),
    ).rejects.toMatchObject({
      code: 'EXTRACTION_FAILED',
      details: { reason: 'too_slow' },
    });
  });
});

describe('documents that are not laboratory reports', () => {
  it('rejects a text PDF without compound values at once, without text recognition', async () => {
    const started = Date.now();
    await expect(
      extractReport(readFileSync(new URL('not-a-lab-report-text.pdf', dir)), 'application/pdf', 'eng+fra'),
    ).rejects.toMatchObject({ code: 'EXTRACTION_FAILED', details: { reason: 'no_compounds' } });
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('rejects an image whose recognised text holds no believable values', async () => {
    await expect(
      extractReport(readFileSync(new URL('not-a-lab-report-image.png', dir)), 'image/png', 'eng+fra'),
    ).rejects.toMatchObject({ code: 'EXTRACTION_FAILED', details: { reason: 'no_compounds' } });
  }, 120_000);
});
