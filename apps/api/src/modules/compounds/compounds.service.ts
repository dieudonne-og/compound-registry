import { createHash, randomUUID } from 'node:crypto';
import { and, count, desc, eq, gte, like, lt, lte, sql } from 'drizzle-orm';
import {
  COMPOUND_COLUMNS,
  type CompoundDetail,
  type CompoundListQuery,
  type CompoundSummary,
  type ConfirmCompoundInput,
  type ExtractionResult,
  type ExtractionWarning,
  type Page,
  type SessionUser,
  type UnmappedValue,
} from '@cr/contracts';
import type { Database } from '../../db/client';
import { compound, compoundExtraction } from '../../db/schema';
import type { Config } from '../../shared/config';
import { AppError, forbidden, notFound } from '../../shared/errors';
import type { Storage } from '../../shared/storage';
import { inspectUpload } from './extraction/intake';
import { extractReport } from './extraction/pipeline';
import { createSemaphore } from '../../shared/semaphore';
import { dayStartUtc, nextDay } from '../../shared/time';

const DAY_MS = 24 * 60 * 60 * 1000;
type StoredResult = {
  purchaseId: string;
  fields: ExtractionResult['fields'];
  unmapped: UnmappedValue[];
  warnings: ExtractionWarning[];
};

const safeName = (name: string) => name.replace(/[^\w.\- ()]/g, '_').slice(0, 200) || 'report';
const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

export function createCompoundService({
  db,
  storage,
  config,
}: {
  db: Database;
  storage: Storage;
  config: Config;
}) {
  const ocrLimit = createSemaphore(config.OCR_CONCURRENCY);
  const summaryFields = {
    row: compound,
    fileName: compoundExtraction.originalName,
    method: compoundExtraction.method,
    confidence: compoundExtraction.overallConfidence,
    mimeType: compoundExtraction.mimeType,
    result: compoundExtraction.result,
    storageKey: compoundExtraction.storageKey,
  };

  const toSummary = (r: {
    row: typeof compound.$inferSelect;
    fileName: string | null;
    method: CompoundSummary['method'];
    confidence: string | null;
  }): CompoundSummary => ({
    id: r.row.id,
    purchaseId: r.row.purchaseId,
    extractionDate: r.row.extractionDate?.toISOString() ?? null,
    fileName: r.fileName,
    method: r.method,
    overallConfidence: r.confidence === null ? null : Number(r.confidence),
    valuesCount: COMPOUND_COLUMNS.filter((c) => r.row[c] !== null).length,
  });

  return {
    async extract(input: {
      buffer: Buffer;
      filename: string;
      purchaseId: string;
      user: SessionUser;
    }): Promise<ExtractionResult> {
      const { mime, ext } = await inspectUpload(input.buffer, input.filename);
      const outcome = await extractReport(input.buffer, mime, config.OCR_LANGS, {
        deadline: Date.now() + config.EXTRACTION_BUDGET_SECONDS * 1000,
        ocrLimit,
      });
      const sha256 = createHash('sha256').update(input.buffer).digest('hex');

      const [previous] = await db
        .select({
          id: compoundExtraction.id,
          compoundId: compoundExtraction.compoundId,
          result: compoundExtraction.result,
          createdAt: compoundExtraction.createdAt,
        })
        .from(compoundExtraction)
        .where(eq(compoundExtraction.sha256, sha256))
        .orderBy(desc(compoundExtraction.createdAt))
        .limit(1);

      const warnings = [...outcome.warnings];
      const duplicateOf = previous
        ? {
            extractionId: previous.id,
            compoundId: previous.compoundId,
            purchaseId: (previous.result as StoredResult).purchaseId,
            createdAt: previous.createdAt.toISOString(),
          }
        : null;
      if (duplicateOf) {
        warnings.push({
          code: 'DUPLICATE_FILE',
          message: `This file was already uploaded for purchase ${duplicateOf.purchaseId} on ${duplicateOf.createdAt.slice(0, 10)}.`,
        });
      }

      const storageKey = await storage.save(input.buffer, ext);
      const id = randomUUID();
      const now = new Date();
      const result: StoredResult = {
        purchaseId: input.purchaseId,
        fields: outcome.fields,
        unmapped: outcome.unmapped,
        warnings,
      };
      try {
        await db.insert(compoundExtraction).values({
          id,
          status: 'pending',
          originalName: safeName(input.filename),
          mimeType: mime,
          sizeBytes: input.buffer.length,
          sha256,
          storageKey,
          method: outcome.method,
          overallConfidence: outcome.overallConfidence.toFixed(4),
          rawText: outcome.rawText,
          result,
          createdBy: input.user.id,
          createdAt: now,
          expiresAt: new Date(now.getTime() + DAY_MS),
        });
      } catch (err) {
        await storage.remove(storageKey);
        throw err;
      }

      return {
        extractionId: id,
        purchaseId: input.purchaseId,
        method: outcome.method,
        pages: outcome.pages,
        overallConfidence: outcome.overallConfidence,
        fields: outcome.fields,
        unmapped: outcome.unmapped,
        warnings,
        duplicateOf,
        rawText: outcome.rawText,
      };
    },

    async confirm(input: ConfirmCompoundInput, user: SessionUser): Promise<{ id: number }> {
      return db.transaction(async (tx) => {
        const [ext] = await tx
          .select()
          .from(compoundExtraction)
          .where(eq(compoundExtraction.id, input.extractionId))
          .for('update');
        if (!ext) throw notFound('extraction');
        if (ext.createdBy !== user.id && user.role !== 'admin') throw forbidden();
        if (ext.status === 'confirmed') {
          throw new AppError('ALREADY_CONFIRMED', 409, 'errors.ALREADY_CONFIRMED', {
            compoundId: ext.compoundId,
          });
        }
        if (ext.status === 'expired' || ext.expiresAt < new Date()) {
          throw new AppError('EXTRACTION_EXPIRED', 410, 'errors.EXTRACTION_EXPIRED');
        }
        const values = Object.fromEntries(COMPOUND_COLUMNS.map((c) => [c, input.values[c] ?? null]));
        const [res] = await tx.insert(compound).values({
          purchaseId: input.purchaseId,
          filePath: ext.storageKey,
          extractionDate: ext.createdAt,
          ...values,
        });
        await tx
          .update(compoundExtraction)
          .set({ status: 'confirmed', compoundId: res.insertId })
          .where(eq(compoundExtraction.id, ext.id));
        return { id: res.insertId };
      });
    },

    async list(query: CompoundListQuery): Promise<Page<CompoundSummary>> {
      const where = and(
        query.purchaseId ? like(compound.purchaseId, `${escapeLike(query.purchaseId)}%`) : undefined,
        // Filter by business day (APP_TIMEZONE), like every other date in the application.
        query.from ? gte(compound.extractionDate, dayStartUtc(query.from, config.APP_TIMEZONE)) : undefined,
        query.to
          ? lt(compound.extractionDate, dayStartUtc(nextDay(query.to), config.APP_TIMEZONE))
          : undefined,
      );
      const [rows, [total]] = await Promise.all([
        db
          .select(summaryFields)
          .from(compound)
          .leftJoin(compoundExtraction, eq(compoundExtraction.compoundId, compound.id))
          .where(where)
          .orderBy(desc(compound.id))
          .limit(query.pageSize)
          .offset((query.page - 1) * query.pageSize),
        db.select({ n: count() }).from(compound).where(where),
      ]);
      return { items: rows.map(toSummary), total: total?.n ?? 0, page: query.page, pageSize: query.pageSize };
    },

    async get(id: number): Promise<CompoundDetail> {
      const [r] = await db
        .select(summaryFields)
        .from(compound)
        .leftJoin(compoundExtraction, eq(compoundExtraction.compoundId, compound.id))
        .where(eq(compound.id, id));
      if (!r) throw notFound('compound');
      const stored = r.result as StoredResult | null;
      return {
        ...toSummary(r),
        mimeType: r.mimeType,
        values: Object.fromEntries(COMPOUND_COLUMNS.map((c) => [c, r.row[c]])),
        unmapped: stored?.unmapped ?? [],
        warnings: stored?.warnings ?? [],
      };
    },

    async file(id: number) {
      const [r] = await db
        .select({
          key: compound.filePath,
          name: compoundExtraction.originalName,
          mime: compoundExtraction.mimeType,
        })
        .from(compound)
        .leftJoin(compoundExtraction, eq(compoundExtraction.compoundId, compound.id))
        .where(eq(compound.id, id));
      if (!r?.key) throw notFound('file');
      return {
        stream: storage.stream(r.key),
        name: r.name ?? 'report',
        mime: r.mime ?? 'application/octet-stream',
      };
    },

    /** Removes files of unconfirmed extractions older than 24 hours. */
    async expirePending(): Promise<number> {
      const expired = await db
        .select({ id: compoundExtraction.id, key: compoundExtraction.storageKey })
        .from(compoundExtraction)
        .where(
          and(
            eq(compoundExtraction.status, 'pending'),
            lte(compoundExtraction.expiresAt, sql`CURRENT_TIMESTAMP(3)`),
          ),
        );
      for (const e of expired) {
        await storage.remove(e.key);
        await db
          .update(compoundExtraction)
          .set({ status: 'expired' })
          .where(and(eq(compoundExtraction.id, e.id), eq(compoundExtraction.status, 'pending')));
      }
      return expired.length;
    },
  };
}
export type CompoundService = ReturnType<typeof createCompoundService>;
