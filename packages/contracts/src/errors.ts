import { z } from 'zod';

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'REASON_REQUIRED',
  'EXTRACTION_FAILED',
  'IDEMPOTENCY_KEY_REUSED',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'CSRF_FAILED',
  'NOT_FOUND',
  'VERSION_CONFLICT',
  'TAG_NUMBER_TAKEN',
  'PRODUCTION_CODE_TAKEN',
  'DUPLICATE_NAME',
  'ALREADY_CONFIRMED',
  'REQUEST_IN_PROGRESS',
  'EXTRACTION_EXPIRED',
  'FILE_TOO_LARGE',
  'UNSUPPORTED_FILE_TYPE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'LAST_ADMIN',
  'SELF_CHANGE_NOT_ALLOWED',
  'EMAIL_TAKEN',
  'WRONG_PASSWORD',
  'PASSWORD_CHANGE_REQUIRED',
  'ACCOUNT_DISABLED',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorBody = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
    requestId: z.string(),
  }),
});
export type ErrorBody = z.infer<typeof errorBody>;
