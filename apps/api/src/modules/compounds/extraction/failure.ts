import { AppError } from '../../../shared/errors';

export const FAILURE_REASONS = [
  'encrypted',
  'unreadable',
  'too_many_pages',
  'no_text',
  'no_compounds',
  'ocr_failed',
  'too_slow',
] as const;

export type FailureReason = (typeof FAILURE_REASONS)[number];

/** The message (a hint on what to do next) comes from the shared catalogue `errors.extraction.<reason>`. */
export const extractionFailed = (reason: FailureReason) =>
  new AppError('EXTRACTION_FAILED', 422, `errors.extraction.${reason}`, { reason });
