import { z } from 'zod';
import { COMPOUND_COLUMNS } from './catalog';
import { percentValue } from './decimal';
import { pageQuery } from './pagination';

export const purchaseId = z
  .string()
  .trim()
  .min(1, 'Purchase ID is required')
  .max(20, 'Purchase ID is at most 20 characters')
  .regex(/^[A-Za-z0-9][A-Za-z0-9\-_/.]*$/, 'Use letters, digits and - _ / . only');

export const EXTRACTION_FLAGS = [
  'low_confidence',
  'fuzzy_name',
  'conflict',
  'out_of_range',
  'precision_truncated',
  'missing_marker',
] as const;
export type ExtractionFlag = (typeof EXTRACTION_FLAGS)[number];

const column = z.enum(COMPOUND_COLUMNS);

export const extractedField = z.object({
  column,
  label: z.string(),
  value: z.string().nullable(),
  rawText: z.string(),
  confidence: z.number().min(0).max(1),
  uncertainty: z.string().nullable(),
  flags: z.array(z.enum(EXTRACTION_FLAGS)),
  candidates: z.array(z.string()).optional(),
});
export type ExtractedField = z.infer<typeof extractedField>;

export const unmappedValue = z.object({
  label: z.string(),
  value: z.string().nullable(),
  rawText: z.string(),
  reason: z.enum(['no_column', 'manual_only']),
});
export type UnmappedValue = z.infer<typeof unmappedValue>;

export const extractionWarning = z.object({
  code: z.enum(['TOTAL_EXCEEDS_100', 'DUPLICATE_FILE', 'LOW_OVERALL_CONFIDENCE']),
  message: z.string(),
});
export type ExtractionWarning = z.infer<typeof extractionWarning>;

export const extractionResult = z.object({
  extractionId: z.string().uuid(),
  purchaseId,
  method: z.enum(['text-layer', 'ocr', 'hybrid']),
  pages: z.number().int(),
  overallConfidence: z.number(),
  fields: z.array(extractedField),
  unmapped: z.array(unmappedValue),
  warnings: z.array(extractionWarning),
  duplicateOf: z
    .object({
      extractionId: z.string(),
      compoundId: z.number().nullable(),
      purchaseId: z.string(),
      createdAt: z.string(),
    })
    .nullable(),
  rawText: z.string(),
});
export type ExtractionResult = z.infer<typeof extractionResult>;

export const compoundValues = z.record(column, percentValue.nullable());

export const confirmCompoundInput = z.object({
  extractionId: z.string().uuid(),
  purchaseId,
  values: compoundValues,
});
export type ConfirmCompoundInput = z.infer<typeof confirmCompoundInput>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const compoundListQuery = pageQuery.extend({
  purchaseId: z.string().trim().max(20).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type CompoundListQuery = z.infer<typeof compoundListQuery>;

export const compoundSummary = z.object({
  id: z.number().int(),
  purchaseId: z.string(),
  extractionDate: z.string().nullable(),
  fileName: z.string().nullable(),
  method: z.enum(['text-layer', 'ocr', 'hybrid']).nullable(),
  overallConfidence: z.number().nullable(),
  valuesCount: z.number().int(),
});
export type CompoundSummary = z.infer<typeof compoundSummary>;

export const compoundDetail = compoundSummary.extend({
  mimeType: z.string().nullable(),
  values: z.record(column, z.string().nullable()),
  unmapped: z.array(unmappedValue),
  warnings: z.array(extractionWarning),
});
export type CompoundDetail = z.infer<typeof compoundDetail>;
