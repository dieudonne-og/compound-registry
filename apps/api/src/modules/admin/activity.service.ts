import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import type {
  ActivityAction,
  ActivityEntry,
  ActivityQuery,
  ActivityTarget,
  Page,
  SessionUser,
} from '@cr/contracts';
import type { Database, Tx } from '../../db/client';
import { adminActivity } from '../../db/schema';

type Json = Record<string, unknown> | null;

/** Appends one line to the administration log, inside the caller's transaction. Never pass secrets here. */
export async function recordActivity(
  conn: Database | Tx,
  entry: {
    actor: SessionUser;
    action: ActivityAction;
    targetType: ActivityTarget;
    targetId: number;
    targetLabel: string;
    before?: Json;
    after?: Json;
  },
) {
  await conn.insert(adminActivity).values({
    actorId: entry.actor.id,
    actorLabel: `${entry.actor.name} (${entry.actor.role})`,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    targetLabel: entry.targetLabel,
    before: entry.before ?? null,
    after: entry.after ?? null,
    occurredAt: new Date(),
  });
}

export async function listActivity(db: Database, query: ActivityQuery): Promise<Page<ActivityEntry>> {
  const filters: SQL[] = [];
  if (query.action) filters.push(eq(adminActivity.action, query.action));
  if (query.targetType) filters.push(eq(adminActivity.targetType, query.targetType));
  const where = filters.length ? and(...filters) : undefined;
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(adminActivity)
      .where(where)
      .orderBy(desc(adminActivity.occurredAt), desc(adminActivity.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ n: count() }).from(adminActivity).where(where),
  ]);
  return {
    items: rows.map((r) => ({
      id: r.id,
      actor: { id: r.actorId, label: r.actorLabel },
      action: r.action as ActivityAction,
      targetType: r.targetType as ActivityTarget,
      targetId: r.targetId,
      targetLabel: r.targetLabel,
      before: (r.before as Json) ?? null,
      after: (r.after as Json) ?? null,
      occurredAt: r.occurredAt.toISOString(),
    })),
    total: total?.n ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  };
}
