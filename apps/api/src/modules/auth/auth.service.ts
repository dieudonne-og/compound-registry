import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull, ne } from 'drizzle-orm';
import type { SessionUser } from '@cr/contracts';
import type { Database, Tx } from '../../db/client';
import { refreshTokens, users } from '../../db/schema';
import { AppError } from '../../shared/errors';
import { hashPassword, verifyPassword } from './password';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** A token rotated this recently may still arrive from a second tab; that is not treated as theft. */
const REUSE_GRACE_MS = 10_000;
// Verified against when the email is unknown, so response time does not reveal which emails exist.
const dummyHash = hashPassword(randomBytes(16).toString('hex'));
export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const toSession = (u: typeof users.$inferSelect): SessionUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
});

/** Ends every session of a user (except, optionally, the one holding `keepTokenHash`). */
export async function revokeAllTokens(db: Database | Tx, userId: number, keepTokenHash?: string) {
  const mine = and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt));
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(keepTokenHash ? and(mine, ne(refreshTokens.tokenHash, keepTokenHash)) : mine);
}

export type LoginResult = { user: SessionUser } | { disabled: true } | null;

export function createAuthService(db: Database) {
  async function issueRefreshToken(userId: number) {
    const token = randomBytes(32).toString('base64url');
    const [res] = await db.insert(refreshTokens).values({
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      createdAt: new Date(),
    });
    return { token, id: res.insertId };
  }

  return {
    /** `disabled` is only reported after a correct password, so it tells a guesser nothing. */
    async login(email: string, password: string): Promise<LoginResult> {
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const ok = await verifyPassword(user?.passwordHash ?? (await dummyHash), password);
      if (!user || !ok) return null;
      if (!user.active) return { disabled: true };
      await db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, user.id));
      return { user: toSession(user) };
    },

    /** Sets a new password, clears a pending forced change and signs out the user's other sessions. */
    async changePassword(userId: number, current: string, next: string, keepTokenHash?: string) {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user || !(await verifyPassword(user.passwordHash, current))) {
        throw new AppError('WRONG_PASSWORD', 422, 'errors.WRONG_PASSWORD', {
          fields: { currentPassword: 'errors.WRONG_PASSWORD' },
        });
      }
      await db
        .update(users)
        .set({ passwordHash: await hashPassword(next), mustChangePassword: false })
        .where(eq(users.id, userId));
      await revokeAllTokens(db, userId, keepTokenHash);
    },

    issueRefreshToken,

    /** Rotates a refresh token. Reusing a revoked token revokes every session of that user. */
    async rotate(token: string): Promise<{ user: SessionUser; token: string } | null> {
      const [row] = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, sha256(token)))
        .limit(1);
      if (!row || row.expiresAt < new Date()) return null;
      const parallelTab =
        row.revokedAt && row.replacedBy && Date.now() - row.revokedAt.getTime() < REUSE_GRACE_MS;
      if (row.revokedAt && !parallelTab) {
        await db
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(refreshTokens.userId, row.userId), isNull(refreshTokens.revokedAt)));
        return null;
      }
      const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
      if (!user?.active) return null;
      const next = await issueRefreshToken(user.id);
      if (parallelTab) return { user: toSession(user), token: next.token };
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date(), replacedBy: next.id })
        .where(eq(refreshTokens.id, row.id));
      return { user: toSession(user), token: next.token };
    },

    async revoke(token: string) {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.tokenHash, sha256(token)), isNull(refreshTokens.revokedAt)));
    },
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
