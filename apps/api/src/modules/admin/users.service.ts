import { randomInt } from 'node:crypto';
import { and, asc, eq } from 'drizzle-orm';
import type {
  CreateUserInput,
  Role,
  SessionUser,
  TemporaryPasswordResponse,
  UpdateUserInput,
  UserAdminView,
} from '@cr/contracts';
import type { Database } from '../../db/client';
import { users } from '../../db/schema';
import { isDuplicate } from '../../shared/db-errors';
import { AppError, notFound } from '../../shared/errors';
import { revokeAllTokens } from '../auth/auth.service';
import { hashPassword } from '../auth/password';
import { recordActivity } from './activity.service';

/** No 0/O, 1/l/I: temporary passwords are read aloud or copied by hand. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function generateTemporaryPassword(length = 16): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

/** Would applying `change` to `target` leave no active administrator? */
export function removesLastAdmin(
  activeAdminIds: number[],
  target: { id: number; role: Role; active: boolean },
  change: { role?: Role; active?: boolean },
): boolean {
  const staysActiveAdmin = (change.role ?? target.role) === 'admin' && (change.active ?? target.active);
  const isActiveAdmin = target.role === 'admin' && target.active;
  return isActiveAdmin && !staysActiveAdmin && activeAdminIds.filter((id) => id !== target.id).length === 0;
}

type UserRow = typeof users.$inferSelect;
const toView = (u: UserRow): UserAdminView => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active,
  mustChangePassword: u.mustChangePassword,
  lastSignInAt: u.lastSignInAt?.toISOString() ?? null,
  createdAt: u.createdAt.toISOString(),
});
const labelOf = (u: { name: string; email: string }) => `${u.name} (${u.email})`;

export function createUsersService(db: Database) {
  async function load(id: number) {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!row) throw notFound('user');
    return row;
  }

  return {
    async list(): Promise<UserAdminView[]> {
      return (await db.select().from(users).orderBy(asc(users.name))).map(toView);
    },

    async create(input: CreateUserInput, actor: SessionUser): Promise<TemporaryPasswordResponse> {
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      try {
        const id = await db.transaction(async (tx) => {
          const [res] = await tx.insert(users).values({
            ...input,
            passwordHash,
            mustChangePassword: true,
            createdAt: new Date(),
          });
          await recordActivity(tx, {
            actor,
            action: 'user.created',
            targetType: 'user',
            targetId: res.insertId,
            targetLabel: labelOf(input),
            after: { name: input.name, email: input.email, role: input.role },
          });
          return res.insertId;
        });
        return { user: toView(await load(id)), temporaryPassword };
      } catch (err) {
        if (isDuplicate(err, 'uq_users_email'))
          throw new AppError('EMAIL_TAKEN', 409, 'errors.EMAIL_TAKEN', { field: 'email' });
        throw err;
      }
    },

    async update(id: number, patch: UpdateUserInput, actor: SessionUser): Promise<UserAdminView> {
      await db.transaction(async (tx) => {
        const [target] = await tx.select().from(users).where(eq(users.id, id)).for('update');
        if (!target) throw notFound('user');
        const changes: Partial<Pick<UserRow, 'name' | 'role' | 'active'>> = {};
        if (patch.name !== undefined && patch.name !== target.name) changes.name = patch.name;
        if (patch.role !== undefined && patch.role !== target.role) changes.role = patch.role;
        if (patch.active !== undefined && patch.active !== target.active) changes.active = patch.active;
        if (!Object.keys(changes).length) return;

        if (target.id === actor.id && (changes.role !== undefined || changes.active !== undefined))
          throw new AppError('SELF_CHANGE_NOT_ALLOWED', 422, 'errors.SELF_CHANGE_NOT_ALLOWED');
        // Locked so two administrators demoting each other at the same moment cannot both succeed.
        const admins = await tx
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.role, 'admin'), eq(users.active, true)))
          .for('update');
        if (
          removesLastAdmin(
            admins.map((a) => a.id),
            target,
            changes,
          )
        )
          throw new AppError('LAST_ADMIN', 409, 'errors.LAST_ADMIN');

        await tx.update(users).set(changes).where(eq(users.id, id));
        if (changes.active === false) await revokeAllTokens(tx, id);
        const before = Object.fromEntries(
          Object.keys(changes).map((k) => [k, target[k as keyof typeof changes]]),
        );
        await recordActivity(tx, {
          actor,
          action:
            changes.active === false
              ? 'user.disabled'
              : changes.active === true
                ? 'user.enabled'
                : 'user.updated',
          targetType: 'user',
          targetId: id,
          targetLabel: labelOf({ name: changes.name ?? target.name, email: target.email }),
          before,
          after: changes,
        });
      });
      return toView(await load(id));
    },

    async resetPassword(id: number, actor: SessionUser): Promise<TemporaryPasswordResponse> {
      const target = await load(id);
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await hashPassword(temporaryPassword);
      await db.transaction(async (tx) => {
        await tx.update(users).set({ passwordHash, mustChangePassword: true }).where(eq(users.id, id));
        await revokeAllTokens(tx, id);
        await recordActivity(tx, {
          actor,
          action: 'user.password_reset',
          targetType: 'user',
          targetId: id,
          targetLabel: labelOf(target),
        });
      });
      return { user: toView(await load(id)), temporaryPassword };
    },
  };
}
