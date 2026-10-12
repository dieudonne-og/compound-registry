import { asc, eq } from 'drizzle-orm';
import type { ReferenceItem, ReferenceKind } from '@cr/contracts';
import type { Database } from '../../db/client';
import { businessLocations, companies, mineralTypes, traceabilityAgents } from '../../db/schema';
import { isDuplicate } from '../../shared/db-errors';
import { AppError, notFound, validationError } from '../../shared/errors';

export const REFERENCE_TABLES = {
  companies,
  locations: businessLocations,
  agents: traceabilityAgents,
  'mineral-types': mineralTypes,
} as const;

type Row = { id: number; name: string; active: boolean; code?: string };
const toItem = (r: Row): ReferenceItem => ({
  id: r.id,
  name: r.name,
  code: r.code ?? null,
  active: r.active,
});

function duplicate(err: unknown): never {
  if (isDuplicate(err, 'name') || isDuplicate(err, 'code')) {
    throw new AppError('DUPLICATE_NAME', 409, 'An entry with this name or code already exists.');
  }
  throw err;
}

export function createReferenceService(db: Database) {
  return {
    async list(kind: ReferenceKind, includeInactive: boolean): Promise<ReferenceItem[]> {
      const table = REFERENCE_TABLES[kind];
      const rows = (await db.select().from(table).orderBy(asc(table.name))) as Row[];
      return rows.filter((r) => includeInactive || r.active).map(toItem);
    },

    async create(kind: ReferenceKind, input: { name: string; code?: string }): Promise<ReferenceItem> {
      if (kind === 'mineral-types' && !input.code)
        throw validationError({ code: 'Mineral types need a short code, e.g. SN.' });
      const table = REFERENCE_TABLES[kind];
      const values = {
        name: input.name,
        createdAt: new Date(),
        ...(kind === 'mineral-types' ? { code: input.code } : {}),
      };
      try {
        const [res] = await db.insert(table).values(values as never);
        return toItem({ id: res.insertId, name: input.name, code: input.code, active: true });
      } catch (err) {
        duplicate(err);
      }
    },

    async update(kind: ReferenceKind, id: number, patch: { name?: string; code?: string; active?: boolean }) {
      const table = REFERENCE_TABLES[kind];
      const set = { ...patch, ...(kind === 'mineral-types' ? {} : { code: undefined }) };
      try {
        await db
          .update(table)
          .set(set as never)
          .where(eq(table.id, id));
      } catch (err) {
        duplicate(err);
      }
      const [row] = (await db.select().from(table).where(eq(table.id, id))) as Row[];
      if (!row) throw notFound('Entry');
      return toItem(row);
    },
  };
}
