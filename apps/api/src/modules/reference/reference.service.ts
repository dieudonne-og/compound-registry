import { asc, count, eq } from 'drizzle-orm';
import type { ReferenceItem, ReferenceKind, SessionUser } from '@cr/contracts';
import type { Database } from '../../db/client';
import { businessLocations, companies, mineralTypes, production, traceabilityAgents } from '../../db/schema';
import { isDuplicate } from '../../shared/db-errors';
import { AppError, notFound, validationError } from '../../shared/errors';
import { recordActivity } from '../admin/activity.service';

export const REFERENCE_TABLES = {
  companies,
  locations: businessLocations,
  agents: traceabilityAgents,
  'mineral-types': mineralTypes,
} as const;

/** The production column that points at each kind, for usage counts. */
const USED_BY = {
  companies: production.companyId,
  locations: production.businessLocationId,
  agents: production.traceabilityAgentId,
  'mineral-types': production.mineralTypeId,
} as const;

type Row = { id: number; name: string; active: boolean; code?: string };
const toItem = (r: Row, usageCount = 0): ReferenceItem => ({
  id: r.id,
  name: r.name,
  code: r.code ?? null,
  active: r.active,
  usageCount,
});
const labelOf = (r: { name: string; code?: string | null }) => (r.code ? `${r.name} (${r.code})` : r.name);

function duplicate(err: unknown): never {
  if (isDuplicate(err, 'name') || isDuplicate(err, 'code')) {
    throw new AppError('DUPLICATE_NAME', 409, 'errors.DUPLICATE_NAME');
  }
  throw err;
}

export function createReferenceService(db: Database) {
  return {
    /** `includeInactive` is the administrators' view: retired entries too, with how many records use each. */
    async list(kind: ReferenceKind, includeInactive: boolean): Promise<ReferenceItem[]> {
      const table = REFERENCE_TABLES[kind];
      const rows = (await db.select().from(table).orderBy(asc(table.name))) as Row[];
      if (!includeInactive) return rows.filter((r) => r.active).map((r) => toItem(r));
      const column = USED_BY[kind];
      const counts = await db.select({ id: column, n: count() }).from(production).groupBy(column);
      const byId = new Map(counts.map((c) => [c.id, c.n]));
      return rows.map((r) => toItem(r, byId.get(r.id) ?? 0));
    },

    async create(
      kind: ReferenceKind,
      input: { name: string; code?: string },
      actor: SessionUser,
    ): Promise<ReferenceItem> {
      if (kind === 'mineral-types' && !input.code)
        throw validationError({ code: 'validation.reference.codeRequired' });
      const table = REFERENCE_TABLES[kind];
      const values = {
        name: input.name,
        createdAt: new Date(),
        ...(kind === 'mineral-types' ? { code: input.code } : {}),
      };
      try {
        return await db.transaction(async (tx) => {
          const [res] = await tx.insert(table).values(values as never);
          const code = kind === 'mineral-types' ? input.code : undefined;
          await recordActivity(tx, {
            actor,
            action: 'reference.created',
            targetType: 'reference',
            targetId: res.insertId,
            targetLabel: `${kind}: ${labelOf({ name: input.name, code })}`,
            after: { name: input.name, ...(code ? { code } : {}) },
          });
          return toItem({ id: res.insertId, name: input.name, code, active: true });
        });
      } catch (err) {
        duplicate(err);
      }
    },

    async update(
      kind: ReferenceKind,
      id: number,
      patch: { name?: string; code?: string; active?: boolean },
      actor: SessionUser,
    ) {
      const table = REFERENCE_TABLES[kind];
      const set = { ...patch, ...(kind === 'mineral-types' ? {} : { code: undefined }) };
      try {
        await db.transaction(async (tx) => {
          const [before] = (await tx.select().from(table).where(eq(table.id, id)).for('update')) as Row[];
          if (!before) throw notFound('entry');
          const changed = (Object.keys(set) as (keyof typeof set)[]).filter(
            (k) => set[k] !== undefined && set[k] !== before[k as keyof Row],
          );
          if (!changed.length) return;
          await tx
            .update(table)
            .set(set as never)
            .where(eq(table.id, id));
          const activeChanged = changed.includes('active');
          await recordActivity(tx, {
            actor,
            action: !activeChanged
              ? 'reference.updated'
              : set.active
                ? 'reference.reactivated'
                : 'reference.retired',
            targetType: 'reference',
            targetId: id,
            targetLabel: `${kind}: ${labelOf({ name: set.name ?? before.name, code: set.code ?? before.code })}`,
            before: Object.fromEntries(changed.map((k) => [k, before[k as keyof Row]])),
            after: Object.fromEntries(changed.map((k) => [k, set[k]])),
          });
        });
      } catch (err) {
        duplicate(err);
      }
      const [row] = (await db.select().from(table).where(eq(table.id, id))) as Row[];
      if (!row) throw notFound('entry');
      return toItem(row);
    },
  };
}
