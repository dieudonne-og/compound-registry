import { createHash } from 'node:crypto';
import { and, eq, lt, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { idempotencyKeys } from '../../db/schema';
import { isDuplicate } from '../../shared/db-errors';
import { AppError } from '../../shared/errors';
import { canonicalJson } from '../audit/canonical';

type Result = { status: number; body: unknown; replayed?: boolean };

/**
 * Runs `fn` at most once per (key, user). A retry with the same body returns the stored
 * response; a different body with the same key is rejected.
 */
export async function withIdempotency(
  db: Database,
  ctx: { key: string; userId: number; body: unknown },
  fn: () => Promise<Result>,
): Promise<Result> {
  const requestHash = createHash('sha256').update(canonicalJson(ctx.body)).digest('hex');
  const where = and(eq(idempotencyKeys.key, ctx.key), eq(idempotencyKeys.userId, ctx.userId));
  try {
    await db
      .insert(idempotencyKeys)
      .values({ key: ctx.key, userId: ctx.userId, requestHash, createdAt: new Date() });
  } catch (err) {
    if (!isDuplicate(err, 'PRIMARY')) throw err;
    const [existing] = await db.select().from(idempotencyKeys).where(where);
    if (existing?.requestHash !== requestHash) {
      throw new AppError('IDEMPOTENCY_KEY_REUSED', 422, 'errors.IDEMPOTENCY_KEY_REUSED');
    }
    if (existing.statusCode === null) {
      throw new AppError('REQUEST_IN_PROGRESS', 409, 'errors.REQUEST_IN_PROGRESS');
    }
    return { status: existing.statusCode, body: existing.response, replayed: true };
  }
  try {
    const result = await fn();
    await db.update(idempotencyKeys).set({ statusCode: result.status, response: result.body }).where(where);
    return result;
  } catch (err) {
    await db.delete(idempotencyKeys).where(where);
    throw err;
  }
}

export const purgeIdempotencyKeys = (db: Database) =>
  db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, sql`NOW(3) - INTERVAL 1 DAY`));
