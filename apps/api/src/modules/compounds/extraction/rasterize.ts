import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Renders one PDF page with poppler. The long side is fixed at 3500 px (about 300 DPI for A4),
 * which also caps memory use for oversized pages. Output is LZW TIFF: poppler's PNG encoder needs
 * ~40 s of CPU for a page this size, LZW about 2 s, and both are lossless.
 */
export async function rasterizePage(pdfPath: string, page: number, dir: string): Promise<Buffer> {
  const prefix = path.join(dir, `page-${page}`);
  await run(
    'pdftoppm',
    [
      '-scale-to',
      '3500',
      '-tiff',
      '-tiffcompression',
      'lzw',
      '-singlefile',
      '-f',
      String(page),
      '-l',
      String(page),
      pdfPath,
      prefix,
    ],
    {
      timeout: 60_000,
    },
  );
  return readFile(`${prefix}.tif`);
}
