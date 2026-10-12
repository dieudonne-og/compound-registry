import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../shared/errors';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT = new Set(['/api/auth/login']);

export const newCsrfToken = () => randomBytes(24).toString('base64url');

/** Double-submit check: the header must equal the readable csrf_token cookie. */
export async function csrfGuard(request: FastifyRequest, _reply: FastifyReply) {
  if (SAFE.has(request.method) || EXEMPT.has(request.routeOptions.url ?? '')) return;
  const cookie = request.cookies.csrf_token ?? '';
  const header = String(request.headers['x-csrf-token'] ?? '');
  const ok =
    cookie.length > 0 &&
    cookie.length === header.length &&
    timingSafeEqual(Buffer.from(cookie), Buffer.from(header));
  if (!ok) throw new AppError('CSRF_FAILED', 403, 'errors.CSRF_FAILED');
}
