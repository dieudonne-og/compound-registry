import { spawn } from 'node:child_process';
import type { TextLine } from './parser';

export function parseTsv(tsv: string): TextLine[] {
  const lines = new Map<string, { words: string[]; confs: number[] }>();
  for (const row of tsv.split('\n').slice(1)) {
    const cols = row.split('\t');
    if (cols.length < 12 || cols[0] !== '5') continue;
    const word = cols[11]!.trim();
    if (!word) continue;
    const key = cols.slice(1, 5).join('-'); // page-block-paragraph-line
    const line = lines.get(key) ?? { words: [], confs: [] };
    line.words.push(word);
    const conf = Number(cols[10]);
    if (conf >= 0) line.confs.push(conf);
    lines.set(key, line);
  }
  return [...lines.values()].map(({ words, confs }) => ({
    text: words.join(' '),
    confidence: confs.length ? Math.round((confs.reduce((a, b) => a + b, 0) / confs.length) * 10) / 1000 : 0,
  }));
}

export function recognize(png: Buffer, opts: { langs: string; psm: 4 | 6 }): Promise<TextLine[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'tesseract',
      [
        'stdin',
        'stdout',
        '-l',
        opts.langs,
        '--psm',
        String(opts.psm),
        '-c',
        'preserve_interword_spaces=1',
        'tsv',
      ],
      // One thread per run: concurrency is controlled by the caller, not by Tesseract.
      { timeout: 90_000, env: { ...process.env, OMP_THREAD_LIMIT: '1' } },
    );
    let out = '';
    let err = '';
    child.stdout.setEncoding('utf8').on('data', (d: string) => (out += d));
    child.stderr.setEncoding('utf8').on('data', (d: string) => (err += d));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(parseTsv(out))
        : reject(new Error(`tesseract exited with ${code}: ${err.slice(0, 300)}`)),
    );
    child.stdin.end(png);
  });
}
