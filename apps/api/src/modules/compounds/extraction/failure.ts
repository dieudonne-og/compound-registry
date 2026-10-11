import { AppError } from '../../../shared/errors';

const HINTS = {
  encrypted: 'This PDF is password-protected. Upload an unprotected copy of the report.',
  unreadable: 'The file could not be opened. It may be damaged — export or scan it again.',
  too_many_pages: 'Reports can have at most 10 pages. Upload only the analysis pages.',
  no_text:
    'No readable text was found. Upload a sharper scan (300 DPI or more) or a photo taken straight on in good light.',
  no_compounds:
    'No compound values were recognised. Check that this is a laboratory analysis report, or upload a sharper scan.',
  ocr_failed: 'Text recognition failed for this file. Try exporting the report as PDF or PNG.',
} as const;

export type FailureReason = keyof typeof HINTS;

export const extractionFailed = (reason: FailureReason) =>
  new AppError('EXTRACTION_FAILED', 422, HINTS[reason], { reason });
