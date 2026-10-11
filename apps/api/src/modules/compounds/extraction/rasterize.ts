import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Renders one PDF page to a 300 DPI PNG with poppler. */
export async function rasterizePage(pdfPath: string, page: number, dir: string): Promise<Buffer> {
  const prefix = path.join(dir, `page-${page}`);
  await run(
    'pdftoppm',
    ['-r', '300', '-png', '-singlefile', '-f', String(page), '-l', String(page), pdfPath, prefix],
    {
      timeout: 60_000,
    },
  );
  return readFile(`${prefix}.png`);
}
