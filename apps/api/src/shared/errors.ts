import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import type { ErrorCode, Language, Params, sharedEn } from '@cr/contracts';
import { tr } from './i18n';

export type Thing = keyof typeof sharedEn.errors.things;

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    /** A shared message key (translated when sent), or a plain sentence passed through as is. */
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly params?: Params,
  ) {
    super(message);
  }
}

/** `fields` maps each field to a message key (or a plain sentence). */
export const validationError = (fields: Record<string, string>) =>
  new AppError('VALIDATION_FAILED', 422, 'errors.VALIDATION_FAILED', { fields });
export const notFound = (thing: Thing) =>
  new AppError('NOT_FOUND', 404, 'errors.NOT_FOUND', undefined, { what: thing });
export const forbidden = () => new AppError('FORBIDDEN', 403, 'errors.FORBIDDEN');

function localiseDetails(language: Language, details?: Record<string, unknown>) {
  const fields = details?.fields;
  if (!fields || typeof fields !== 'object') return details;
  const translated = Object.fromEntries(
    Object.entries(fields as Record<string, unknown>).map(([field, message]) => [
      field,
      typeof message === 'string' ? tr(language, message) : message,
    ]),
  );
  return { ...details, fields: translated };
}

function localiseMessage(language: Language, error: AppError) {
  const what = error.params?.what;
  const params =
    what === undefined ? error.params : { ...error.params, what: tr(language, `errors.things.${what}`) };
  return tr(language, error.message, params);
}

export function errorHandler(error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) {
  const language = request.language ?? 'en';
  const send = (status: number, code: ErrorCode, message: string, details?: Record<string, unknown>) =>
    reply
      .status(status)
      .send({ error: { code, message, details: localiseDetails(language, details), requestId: request.id } });
  const sendCode = (status: number, code: ErrorCode, details?: Record<string, unknown>) =>
    send(status, code, tr(language, `errors.${code}`), details);

  if (error instanceof AppError)
    return send(error.status, error.code, localiseMessage(language, error), error.details);

  if (hasZodFastifySchemaValidationErrors(error)) {
    const fields: Record<string, string> = {};
    for (const issue of error.validation) {
      const path =
        issue.instancePath.replace(/^\//, '').replace(/\//g, '.') ||
        issue.params?.issue?.path?.join('.') ||
        '_';
      fields[path] ??= issue.message ?? 'Invalid value';
    }
    return sendCode(422, 'VALIDATION_FAILED', { fields });
  }

  if (error.code === 'FST_REQ_FILE_TOO_LARGE' || error.statusCode === 413)
    return sendCode(413, 'FILE_TOO_LARGE');
  if (error.statusCode === 429) return sendCode(429, 'RATE_LIMITED');
  if (error.statusCode && error.statusCode < 500)
    return send(error.statusCode, 'VALIDATION_FAILED', error.message);

  request.log.error({ err: error }, 'unhandled error');
  return sendCode(500, 'INTERNAL_ERROR');
}
