import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import type { ErrorCode } from '@cr/contracts';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const validationError = (fields: Record<string, string>) =>
  new AppError('VALIDATION_FAILED', 422, 'Some fields need your attention.', { fields });
export const notFound = (what: string) => new AppError('NOT_FOUND', 404, `${what} was not found.`);
export const forbidden = () => new AppError('FORBIDDEN', 403, 'You do not have permission to do this.');

export function errorHandler(error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply) {
  const send = (status: number, code: ErrorCode, message: string, details?: Record<string, unknown>) =>
    reply.status(status).send({ error: { code, message, details, requestId: request.id } });

  if (error instanceof AppError) return send(error.status, error.code, error.message, error.details);

  if (hasZodFastifySchemaValidationErrors(error)) {
    const fields: Record<string, string> = {};
    for (const issue of error.validation) {
      const path =
        issue.instancePath.replace(/^\//, '').replace(/\//g, '.') ||
        issue.params?.issue?.path?.join('.') ||
        '_';
      fields[path] ??= issue.message ?? 'Invalid value';
    }
    return send(422, 'VALIDATION_FAILED', 'Some fields need your attention.', { fields });
  }

  if (error.code === 'FST_REQ_FILE_TOO_LARGE' || error.statusCode === 413) {
    return send(413, 'FILE_TOO_LARGE', 'The file is larger than the allowed upload size.');
  }
  if (error.statusCode === 429)
    return send(429, 'RATE_LIMITED', 'Too many requests. Please wait a moment and try again.');
  if (error.statusCode && error.statusCode < 500)
    return send(error.statusCode, 'VALIDATION_FAILED', error.message);

  request.log.error({ err: error }, 'unhandled error');
  return send(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
}
