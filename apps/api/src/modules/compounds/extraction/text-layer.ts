import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { withTempDir } from '../../../shared/temp';
import { extractionFailed } from './failure';

const run = promisify(execFile);

/**
 * Reads the embedded text layer with poppler, one string per page.
 * `-layout` keeps table rows on one line, which the parser relies on.
 */
export async function readPdfText(buffer: Buffer, maxPages = 10): Promise<string[]> {
  return withTempDir(async (dir) => {
    const file = path.join(dir, 'input.pdf');
    await writeFile(file, buffer);

    let info: string;
    try {
      ({ stdout: info } = await run('pdfinfo', [file], { timeout: 30_000 }));
    } catch (err) {
      const stderr = String((err as { stderr?: string }).stderr ?? '');
      throw extractionFailed(/password|encrypt/i.test(stderr) ? 'encrypted' : 'unreadable');
    }
    const pages = Number(/^Pages:\s+(\d+)/m.exec(info)?.[1] ?? 0);
    if (!pages) throw extractionFailed('unreadable');
    if (pages > maxPages) throw extractionFailed('too_many_pages');

    const { stdout } = await run('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], {
      timeout: 60_000,
      maxBuffer: 20 * 1024 * 1024,
    });
    return stdout
      .split('\f')
      .slice(0, pages)
      .map((page) =>
        page
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .join('\n'),
      );
  });
}

const READABLE = /[\x20-\x7E\u00A0-\u024F\u2018-\u201D\u2080-\u2089\u00B1\u00B0\u03C3]/u;

/**
 * 0–1 score of how trustworthy an embedded text layer is. Scanner software often embeds
 * mis-recognised text (e.g. CJK characters inside formulas); a few percent of such
 * characters is enough to distrust the whole layer and fall back to OCR.
 */
export function textQuality(text: string): number {
  const chars = [...text.replace(/\s/g, '')];
  if (chars.length < 20) return 0;
  const readable = chars.filter((c) => READABLE.test(c)).length / chars.length;
  return Math.max(0, Math.min(1, (readable - 0.9) / 0.1));
}
