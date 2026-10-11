import { asc, desc, eq } from 'drizzle-orm';
import { roundDecimal, type AuditEventView, type FieldChange, type SessionUser } from '@cr/contracts';
import type { Database, Tx } from '../../db/client';
import { mineralTypes, production, productionAuditEvent } from '../../db/schema';
import { nextEvent, verifyChain, type CriticalSnapshot, type StoredEvent } from './chain';

type EventRow = typeof productionAuditEvent.$inferSelect;

const toStored = (r: EventRow): StoredEvent => ({
  productionId: r.productionId,
  seq: r.seq,
  eventType: r.eventType,
  changes: r.changes as FieldChange[],
  reason: r.reason ?? null,
  actorId: r.actorId,
  actorLabel: r.actorLabel,
  occurredAt: r.occurredAt.toISOString(),
  prevHash: r.prevHash,
  hash: r.hash,
});

export const snapshotOf = (row: {
  productionCode: string;
  tagNumber: string;
  weightKg: string;
  mineralTypeId: number;
}): CriticalSnapshot => ({
  productionCode: row.productionCode,
  tagNumber: row.tagNumber,
  weightKg: roundDecimal(row.weightKg, 3),
  mineralTypeId: row.mineralTypeId,
});

export function createAuditService(db: Database, secret: string) {
  const events = async (productionId: number, conn: Database | Tx = db) =>
    (
      await conn
        .select()
        .from(productionAuditEvent)
        .where(eq(productionAuditEvent.productionId, productionId))
        .orderBy(asc(productionAuditEvent.seq))
    ).map(toStored);

  return {
    /** Appends an event. Callers must hold a row lock on the production record (SELECT … FOR UPDATE). */
    async append(
      tx: Tx,
      data: {
        productionId: number;
        eventType: 'CREATE' | 'UPDATE';
        changes: FieldChange[];
        reason: string | null;
        actor: SessionUser;
      },
    ) {
      const [last] = await tx
        .select()
        .from(productionAuditEvent)
        .where(eq(productionAuditEvent.productionId, data.productionId))
        .orderBy(desc(productionAuditEvent.seq))
        .limit(1);
      const event = nextEvent(secret, last ? toStored(last) : null, {
        productionId: data.productionId,
        eventType: data.eventType,
        changes: data.changes,
        reason: data.reason,
        actorId: data.actor.id,
        actorLabel: `${data.actor.name} (${data.actor.role})`,
        occurredAt: new Date().toISOString(),
      });
      await tx.insert(productionAuditEvent).values({ ...event, occurredAt: new Date(event.occurredAt) });
      return event;
    },

    events,

    verify: async (productionId: number, current: CriticalSnapshot) =>
      verifyChain(secret, await events(productionId), current),

    async history(productionId: number): Promise<AuditEventView[]> {
      const list = await events(productionId);
      const minerals = new Map(
        (await db.select().from(mineralTypes)).map((m) => [m.id, `${m.name} (${m.code})`]),
      );
      const label = (field: FieldChange['field'], v: string | number | null) =>
        v === null
          ? null
          : field === 'mineralTypeId'
            ? (minerals.get(Number(v)) ?? `#${v}`)
            : field === 'weightKg'
              ? `${v} kg`
              : String(v);
      return list.map((e) => ({
        seq: e.seq,
        eventType: e.eventType,
        changes: e.changes.map((c) => ({
          ...c,
          fromLabel: label(c.field, c.from),
          toLabel: label(c.field, c.to)!,
        })),
        reason: e.reason,
        actor: { id: e.actorId, label: e.actorLabel },
        occurredAt: e.occurredAt,
        prevHash: e.prevHash,
        hash: e.hash,
      }));
    },

    /** Verifies every record; also counts events whose record no longer exists. */
    async verifyAll(): Promise<{ intact: number; tampered: number }> {
      const rows = await db.select().from(production);
      const all = (
        await db
          .select()
          .from(productionAuditEvent)
          .orderBy(asc(productionAuditEvent.productionId), asc(productionAuditEvent.seq))
      ).map(toStored);
      const byRecord = new Map<number, StoredEvent[]>();
      for (const e of all) byRecord.set(e.productionId, [...(byRecord.get(e.productionId) ?? []), e]);
      let intact = 0;
      let tampered = 0;
      for (const row of rows) {
        const ok = verifyChain(secret, byRecord.get(row.id) ?? [], snapshotOf(row)).status === 'intact';
        if (ok) intact++;
        else tampered++;
        byRecord.delete(row.id);
      }
      return { intact, tampered: tampered + byRecord.size };
    },
  };
}
export type AuditService = ReturnType<typeof createAuditService>;
