import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { withTempDir } from '../../../shared/temp';
import { extractionFailed } from './failure';
import type { AcceptedMime } from './intake';
import { recognize } from './ocr';
import { parseLines, type ParseResult, type TextLine } from './parser';
import { alternativePreparations, prepareForOcr } from './preprocess';
import { rasterizePage } from './rasterize';
import { readPdfText, textQuality } from './text-layer';
import { votedLines } from './vote';
import type { Semaphore } from '../../../shared/semaphore';

export type ExtractOptions = { deadline?: number; ocrLimit?: Semaphore };

/** Escalation adds four OCR runs; only start it when this much time is left. */
const ESCALATION_MS = 30_000;

export type ExtractionOutcome = ParseResult & {
  method: 'text-layer' | 'ocr' | 'hybrid';
  pages: number;
  rawText: string;
};

const TEXT_LAYER_THRESHOLD = 0.8;
const STRONG_CONFIDENCE = 0.85;

type OcrRun = { lines: TextLine[]; parsed: ParseResult; found: number };

async function runOcr(
  images: Buffer[],
  modes: readonly (4 | 6)[],
  langs: string,
  opts: ExtractOptions,
): Promise<OcrRun[]> {
  const runs: OcrRun[] = [];
  for (const image of images) {
    for (const psm of modes) {
      if (opts.deadline !== undefined && Date.now() > opts.deadline) throw extractionFailed('too_slow');
      let lines: TextLine[];
      try {
        const read = () => recognize(image, { langs, psm });
        lines = await (opts.ocrLimit ? opts.ocrLimit.run(read) : read());
      } catch {
        throw extractionFailed('ocr_failed');
      }
      const parsed = parseLines(lines);
      runs.push({
        lines,
        parsed,
        found: parsed.fields.filter((f) => f.value !== null).length + parsed.unmapped.length,
      });
    }
  }
  return runs;
}

/**
 * Standard preparation in two page-segmentation modes; the better run wins when it is confident.
 * Otherwise (noisy photos, screens) alternative preparations are added and the runs are combined by vote.
 */
async function ocrBest(image: Buffer, langs: string, opts: ExtractOptions): Promise<TextLine[]> {
  let standard: Buffer;
  try {
    standard = await prepareForOcr(image);
  } catch {
    throw extractionFailed('unreadable');
  }
  const runs = await runOcr([standard], [6, 4], langs, opts);
  const best = runs.reduce((a, b) =>
    b.found > a.found || (b.found === a.found && b.parsed.overallConfidence > a.parsed.overallConfidence)
      ? b
      : a,
  );
  const strong = best.found > 0 && best.parsed.overallConfidence >= STRONG_CONFIDENCE;
  const timeLeft = opts.deadline === undefined || opts.deadline - Date.now() > ESCALATION_MS;
  if (strong || !timeLeft) return best.lines;

  const extra = await runOcr(await alternativePreparations(image), [6], langs, opts);
  return votedLines([...runs, ...extra].map((r) => r.parsed));
}

export async function extractReport(
  buffer: Buffer,
  mime: AcceptedMime,
  langs: string,
  opts: ExtractOptions = {},
): Promise<ExtractionOutcome> {
  const pageLines: TextLine[][] = [];
  let textPages = 0;
  let ocrPages = 0;

  if (mime === 'application/pdf') {
    const texts = await readPdfText(buffer);
    await withTempDir(async (dir) => {
      const pdfPath = path.join(dir, 'input.pdf');
      let written = false;
      for (const [index, text] of texts.entries()) {
        const lines = text.split('\n').map((t) => ({ text: t, confidence: 1 }));
        if (textQuality(text) >= TEXT_LAYER_THRESHOLD && parseLines(lines).fields.length > 0) {
          pageLines.push(lines);
          textPages++;
          continue;
        }
        if (!written) {
          await writeFile(pdfPath, buffer);
          written = true;
        }
        if (opts.deadline !== undefined && Date.now() > opts.deadline) throw extractionFailed('too_slow');
        pageLines.push(await ocrBest(await rasterizePage(pdfPath, index + 1, dir), langs, opts));
        ocrPages++;
      }
    });
  } else {
    pageLines.push(await ocrBest(buffer, langs, opts));
    ocrPages++;
  }

  const lines = pageLines.flat();
  const rawText = lines
    .map((l) => l.text)
    .join('\n')
    .trim();
  if (!rawText) throw extractionFailed('no_text');

  const result = parseLines(lines);
  if (!result.fields.length && !result.unmapped.length) throw extractionFailed('no_compounds');

  const method = ocrPages === 0 ? 'text-layer' : textPages === 0 ? 'ocr' : 'hybrid';
  return { ...result, method, pages: pageLines.length, rawText };
}
