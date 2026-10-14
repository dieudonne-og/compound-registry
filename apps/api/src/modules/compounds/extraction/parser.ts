import {
  COMPOUND_COLUMNS,
  ELEMENT_SYMBOLS,
  roundDecimal,
  type CompoundColumn,
  type ExtractedField,
  type ExtractionFlag,
  type ExtractionWarning,
  type UnmappedValue,
} from '@cr/contracts';
import { matchCompound, type CompoundMatch } from './catalog-index';
import { normalizeLine } from './normalize';

export type TextLine = { text: string; confidence: number };
export type ParseResult = {
  fields: ExtractedField[];
  unmapped: UnmappedValue[];
  warnings: ExtractionWarning[];
  overallConfidence: number;
};

const LOW_CONFIDENCE = 0.85;

/** Lines that describe the sample rather than its composition. */
const SKIP_LINE =
  /\b(?:kgs?|poids|weight|net|tel|phone|fax|e-?mail|address|customer|date|report\s*no|certificate|cert|sample\s*no|lot|shipment|registration|box)\b|n°/i;

/**
 * token, separator ("=", ":", "-" or whitespace), value or missing marker, optional second number.
 * The look-behind stops matches inside identifiers such as "Man_Sn".
 */
const PAIR =
  /(?<![\p{L}\p{N}_./-])(\p{L}[\p{L}0-9]{0,9})(?:\s*[=:≈-]\s*|\s+)(<\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?|n\.?d\.?|<\s*(?:lod|dl)|\/|-)(?:\s*%)?(?:\s+(\d+(?:\.\d+)?)(?![\p{L}\p{N}_.]))?(?![\p{L}\p{N}_.])/giu;

/** Standard atomic masses (≤ 100) of elements that have their own column; larger ones cannot be percentages. */
const ATOMIC_MASS: Record<string, string> = {
  Cl: '35.45',
  Ti: '47.867',
  Mn: '54.938',
  Fe: '55.845',
  Co: '58.933',
  Ni: '58.693',
  Cu: '63.546',
  Zn: '65.38',
  As: '74.922',
};

function isAtomicMass(label: string, raw: string): boolean {
  const mass = ATOMIC_MASS[label];
  const decimals = raw.split('.')[1]?.length ?? 0;
  if (!mass || decimals < 2) return false;
  const massDecimals = mass.split('.')[1]!.length;
  return (
    roundDecimal(mass, Math.min(decimals, massDecimals)) ===
    roundDecimal(raw, Math.min(decimals, massDecimals))
  );
}

const MISSING = /^(?:\/|-|n\.?d\.?|<.*)$/i;
const UNCERTAINTY_HEADER = /±|2\s*σ|\+\/-|\berror\b/i;
const ORDER = new Map(COMPOUND_COLUMNS.map((c, i) => [c, i]));
const round3 = (n: number) => Math.round(n * 1000) / 1000;

function buildField(
  match: CompoundMatch,
  raw: string,
  second: string | undefined,
  uncertaintyMode: boolean,
  lineConfidence: number,
  text: string,
): ExtractedField {
  const flags: ExtractionFlag[] = [];
  let value: string | null = null;
  let plausibility = 1;

  if (MISSING.test(raw)) {
    flags.push('missing_marker');
  } else {
    value = roundDecimal(raw, 4);
    if ((raw.split('.')[1]?.length ?? 0) > 4) flags.push('precision_truncated');
    if (Number(raw) > 100) {
      flags.push('out_of_range');
      plausibility = 0.3;
    } else if (!raw.includes('.')) {
      plausibility = 0.5; // lab percentages carry decimals; bare integers are usually seal or page numbers
    } else if (isAtomicMass(match.def.label, raw)) {
      plausibility = 0.5; // periodic-table stamps print the atomic mass next to the symbol
    }
  }
  if (match.fuzzy) flags.push('fuzzy_name');
  const confidence = round3(lineConfidence * match.score * plausibility);
  if (confidence < LOW_CONFIDENCE) flags.push('low_confidence');

  return {
    column: match.def.column,
    label: match.def.label,
    value,
    rawText: text,
    confidence,
    uncertainty: uncertaintyMode && second ? second : null,
    flags,
  };
}

function merge(byColumn: Map<CompoundColumn, ExtractedField>, field: ExtractedField) {
  const existing = byColumn.get(field.column);
  if (!existing) return void byColumn.set(field.column, field);
  if (existing.value === field.value) {
    if (field.confidence > existing.confidence) byColumn.set(field.column, field);
    return;
  }
  const candidates = [...new Set([...(existing.candidates ?? [existing.value]), field.value])].filter(
    (v): v is string => v !== null,
  );
  const flags = [
    ...new Set<ExtractionFlag>(['conflict', ...existing.flags.filter((f) => f !== 'missing_marker')]),
  ];
  byColumn.set(field.column, { ...existing, candidates, flags });
}

export function parseLines(lines: TextLine[]): ParseResult {
  const uncertaintyMode = lines.some((l) => UNCERTAINTY_HEADER.test(l.text));
  const byColumn = new Map<CompoundColumn, ExtractedField>();
  const unmapped: UnmappedValue[] = [];

  for (const line of lines) {
    const text = normalizeLine(line.text);
    if (!text || SKIP_LINE.test(text)) continue;

    for (const [, token, rawValue, second] of text.matchAll(PAIR)) {
      const raw = rawValue!.replace(/\s+/g, '');
      const match = matchCompound(token!);
      const isNumber = /^\d+(\.\d+)?$/.test(raw);

      if (!match) {
        // Only decimal values: integers next to symbols are almost always atomic numbers on seals.
        if (isNumber && raw.includes('.') && Number(raw) <= 100 && ELEMENT_SYMBOLS.has(token!)) {
          unmapped.push({ label: token!, value: raw, rawText: text, reason: 'no_column' });
        }
        continue;
      }
      if (!match.def.autoFill) {
        if (isNumber)
          unmapped.push({ label: match.def.label, value: raw, rawText: text, reason: 'manual_only' });
        continue;
      }
      merge(byColumn, buildField(match, raw, second, uncertaintyMode, line.confidence, text));
    }
  }

  const fields = [...byColumn.values()].sort((a, b) => ORDER.get(a.column)! - ORDER.get(b.column)!);
  const overallConfidence = fields.length
    ? round3(fields.reduce((sum, f) => sum + f.confidence, 0) / fields.length)
    : 0;

  const warnings: ExtractionWarning[] = [];
  const total = fields
    .filter((f) => f.value !== null && f.column !== 'moisture_percent')
    .reduce((sum, f) => sum + Number(f.value), 0);
  if (total > 105) {
    warnings.push({
      code: 'TOTAL_EXCEEDS_100',
      message: `The recognised values add up to ${total.toFixed(2)} %. Check for misread digits.`,
      params: { total: total.toFixed(2) },
    });
  }
  if (fields.length && overallConfidence < 0.7) {
    warnings.push({
      code: 'LOW_OVERALL_CONFIDENCE',
      message:
        'Text recognition confidence is low for this document. Check every value against the original.',
    });
  }
  return { fields, unmapped, warnings, overallConfidence };
}
