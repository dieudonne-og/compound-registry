import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readPdfText, textQuality } from './text-layer';

const fixture = (name: string) =>
  readFileSync(new URL(`../../../../test/fixtures/reports/${name}`, import.meta.url));

describe('PDF text layer', () => {
  it('reads selectable text line by line', async () => {
    const [page] = await readPdfText(fixture('analysis-certificate-text.pdf'));
    expect(page).toMatch(/CERTIFICAT D.ANALYSES/);
    expect(page).toMatch(/Sn\s+58\.72/);
  });
  it('scores a clean text layer as usable', async () => {
    const [page] = await readPdfText(fixture('analysis-certificate-text.pdf'));
    expect(textQuality(page!)).toBeGreaterThanOrEqual(0.8);
  });
  it('scores the garbled scanner text layer as unusable', async () => {
    const [page] = await readPdfText(fixture('assay-certificate-scanned.pdf'));
    expect(textQuality(page!)).toBeLessThan(0.8);
  });
  it('returns an empty page for image-only PDFs', async () => {
    const [page] = await readPdfText(fixture('analysis-report-image-only.pdf'));
    expect(page!.trim()).toBe('');
    expect(textQuality(page!)).toBe(0);
  });
  it('rejects damaged PDFs with a helpful reason', async () => {
    await expect(readPdfText(Buffer.from('%PDF-1.7\nbroken'))).rejects.toMatchObject({
      code: 'EXTRACTION_FAILED',
      details: { reason: 'unreadable' },
    });
  });
});
