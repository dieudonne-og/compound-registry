import { randomUUID } from 'node:crypto';
import { and, count, eq } from 'drizzle-orm';
import {
  can,
  roundDecimal,
  type CreateProductionInput,
  type Page,
  type ProductionListQuery,
  type ProductionRecord,
  type SessionUser,
  type UpdateProductionInput,
} from '@cr/contracts';
import type { Database, Tx } from '../../db/client';
import { businessLocations, companies, mineralTypes, production, traceabilityAgents } from '../../db/schema';
import type { Config } from '../../shared/config';
import { isDuplicate } from '../../shared/db-errors';
import { AppError, forbidden, notFound, validationError } from '../../shared/errors';
import { todayIn } from '../../shared/time';
import { createAuditService, snapshotOf } from '../audit/audit.service';
import { diffCritical } from '../audit/chain';
import { toCsv } from './csv';
import { filtersFor, orderFor, selectProduction, toRecord } from './production.query';

type Fields = Omit<CreateProductionInput, 'productionCode'>;

/** Generated IDs use this format; reserving it means a supplied ID can never collide with a later record. */
const GENERATED_CODE = /^PRD-\d{4}-\d{6}$/;
const reservedCode = () =>
  validationError({
    productionCode:
      'This format is reserved for generated IDs. Leave the ID empty to generate one, or use another format.',
  });

function uniqueViolation(err: unknown): never {
  if (isDuplicate(err, 'uq_production_tag')) {
    throw new AppError('TAG_NUMBER_TAKEN', 409, 'This tag number is already registered.', {
      field: 'tagNumber',
    });
  }
  if (isDuplicate(err, 'uq_production_code')) {
    throw new AppError('PRODUCTION_CODE_TAKEN', 409, 'This production ID is already in use.', {
      field: 'productionCode',
    });
  }
  throw err;
}

export function createProductionService({ db, config }: { db: Database; config: Config }) {
  const audit = createAuditService(db, config.AUDIT_SECRET);

  /** References must be active, except ones the record already uses and keeps (they may have been retired since). */
  async function validateFields(tx: Tx, input: Fields, current?: typeof production.$inferSelect) {
    const errors: Record<string, string> = {};
    if (input.productionDate > todayIn(config.APP_TIMEZONE))
      errors.productionDate = 'Production date cannot be in the future.';
    const checks = [
      ['mineralTypeId', mineralTypes, input.mineralTypeId, 'Select an active mineral type.'],
      [
        'businessLocationId',
        businessLocations,
        input.businessLocationId,
        'Select an active business location.',
      ],
      [
        'traceabilityAgentId',
        traceabilityAgents,
        input.traceabilityAgentId,
        'Select an active traceability agent.',
      ],
      ['companyId', companies, input.companyId, 'Select an active company.'],
    ] as const;
    for (const [field, table, id, message] of checks) {
      if (current && current[field] === id) continue;
      const [row] = await tx
        .select({ id: table.id })
        .from(table)
        .where(and(eq(table.id, id), eq(table.active, true)));
      if (!row) errors[field] = message;
    }
    if (Object.keys(errors).length) throw validationError(errors);
  }

  async function load(conn: Database | Tx, id: number): Promise<ProductionRecord> {
    const [row] = await selectProduction(conn).where(eq(production.id, id));
    if (!row) throw notFound('Production record');
    return toRecord(row);
  }

  const columnsOf = (input: Fields) => ({
    tagNumber: input.tagNumber,
    productionDate: input.productionDate,
    mineralTypeId: input.mineralTypeId,
    weightKg: roundDecimal(input.weightKg, 3),
    businessLocationId: input.businessLocationId,
    traceabilityAgentId: input.traceabilityAgentId,
    companyId: input.companyId,
    operatorRepresentative: input.operatorRepresentative,
  });

  return {
    async create(input: CreateProductionInput, user: SessionUser): Promise<ProductionRecord> {
      if (input.productionCode && GENERATED_CODE.test(input.productionCode)) throw reservedCode();
      return db.transaction(async (tx) => {
        await validateFields(tx, input);
        const now = new Date();
        let id: number;
        try {
          const [res] = await tx.insert(production).values({
            ...columnsOf(input),
            productionCode: input.productionCode ?? `TMP-${randomUUID().slice(0, 12)}`,
            createdBy: user.id,
            createdAt: now,
            updatedAt: now,
          });
          id = res.insertId;
        } catch (err) {
          uniqueViolation(err);
        }
        const productionCode =
          input.productionCode ??
          `PRD-${todayIn(config.APP_TIMEZONE).slice(0, 4)}-${String(id).padStart(6, '0')}`;
        if (!input.productionCode)
          await tx.update(production).set({ productionCode }).where(eq(production.id, id));

        const snapshot = snapshotOf({ ...columnsOf(input), productionCode });
        await audit.append(tx, {
          productionId: id,
          eventType: 'CREATE',
          changes: diffCritical(null, snapshot),
          reason: null,
          actor: user,
        });
        return load(tx, id);
      });
    },

    async update(id: number, input: UpdateProductionInput, user: SessionUser): Promise<ProductionRecord> {
      return db.transaction(async (tx) => {
        const [row] = await tx.select().from(production).where(eq(production.id, id)).for('update');
        if (!row) throw notFound('Production record');
        if (!can(user, 'production:update', { createdBy: row.createdBy })) throw forbidden();
        if (row.version !== input.version) {
          throw new AppError(
            'VERSION_CONFLICT',
            409,
            'Someone else changed this record while you were editing it.',
            {
              currentVersion: row.version,
            },
          );
        }

        const next = { ...columnsOf(input), productionCode: input.productionCode };
        const changes = diffCritical(snapshotOf(row), snapshotOf(next));
        if (changes.some((c) => c.field === 'productionCode') && !can(user, 'production:update-code'))
          throw forbidden();
        if (changes.some((c) => c.field !== 'productionCode') && !can(user, 'production:update-critical'))
          throw forbidden();
        if (changes.some((c) => c.field === 'productionCode') && GENERATED_CODE.test(input.productionCode)) {
          throw reservedCode();
        }
        if (changes.length && !input.reason) {
          throw new AppError(
            'REASON_REQUIRED',
            422,
            'Give a reason for changing the tag number, weight, mineral type or ID.',
            {
              fields: { reason: 'A reason is required for this change.' },
            },
          );
        }

        const nonCriticalChanged =
          row.productionDate !== next.productionDate ||
          row.businessLocationId !== next.businessLocationId ||
          row.traceabilityAgentId !== next.traceabilityAgentId ||
          row.companyId !== next.companyId ||
          row.operatorRepresentative !== next.operatorRepresentative;
        if (!changes.length && !nonCriticalChanged) return load(tx, id);

        await validateFields(tx, input, row);
        try {
          await tx
            .update(production)
            .set({ ...next, version: row.version + 1, updatedBy: user.id, updatedAt: new Date() })
            .where(eq(production.id, id));
        } catch (err) {
          uniqueViolation(err);
        }
        if (changes.length) {
          await audit.append(tx, {
            productionId: id,
            eventType: 'UPDATE',
            changes,
            reason: input.reason ?? null,
            actor: user,
          });
        }
        return load(tx, id);
      });
    },

    get: (id: number) => load(db, id),

    async list(query: ProductionListQuery, opts: { limit?: number } = {}): Promise<Page<ProductionRecord>> {
      const where = filtersFor(query);
      const pageSize = opts.limit ?? query.pageSize;
      const [rows, [total]] = await Promise.all([
        selectProduction(db)
          .where(where)
          .orderBy(...orderFor(query.sort))
          .limit(pageSize)
          .offset((query.page - 1) * pageSize),
        db.select({ n: count() }).from(production).where(where),
      ]);
      return { items: rows.map(toRecord), total: total?.n ?? 0, page: query.page, pageSize };
    },

    /** All matching records, read in batches so large exports never stop at an arbitrary row count. */
    async exportCsv(query: ProductionListQuery, opts: { batchSize?: number } = {}): Promise<string> {
      const batchSize = opts.batchSize ?? 1000;
      const items: ProductionRecord[] = [];
      for (let page = 1; ; page++) {
        const batch = await this.list({ ...query, page }, { limit: batchSize });
        items.push(...batch.items);
        if (batch.items.length < batchSize) break;
      }
      return toCsv([
        [
          'Production ID',
          'Tag Number',
          'Production Date',
          'Mineral Type',
          'Weight (kg)',
          'Company',
          'Business Location',
          'Traceability Agent',
          'Operator Representative',
          'Created By',
          'Created At',
          'Last Updated At',
        ],
        ...items.map((r) => [
          r.productionCode,
          r.tagNumber,
          r.productionDate,
          r.mineralType.name,
          r.weightKg,
          r.company.name,
          r.businessLocation.name,
          r.traceabilityAgent.name,
          r.operatorRepresentative,
          r.createdBy.name,
          r.createdAt,
          r.updatedAt,
        ]),
      ]);
    },

    async history(id: number) {
      await load(db, id);
      return audit.history(id);
    },

    async verify(id: number) {
      return db.transaction(async (tx) => {
        const [row] = await tx.select().from(production).where(eq(production.id, id));
        if (!row) throw notFound('Production record');
        return audit.verify(id, snapshotOf(row), tx);
      });
    },

    verifyAll: () => audit.verifyAll(),
  };
}
export type ProductionService = ReturnType<typeof createProductionService>;
