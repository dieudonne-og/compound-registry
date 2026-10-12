import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { createTestApp, login, request, type Session, type TestApp } from '../helpers';
import { nextEvent, type StoredEvent } from '../../src/modules/audit/chain';
import type { FieldChange } from '@cr/contracts';

let t: TestApp;
let supervisor: Session;
let auditor: Session;
const ref: Record<string, number> = {};

beforeAll(async () => {
  t = await createTestApp();
  supervisor = await login(t.app, 'supervisor');
  auditor = await login(t.app, 'auditor');
  for (const [key, table] of [
    ['mineralTypeId', 'mineral_types'],
    ['businessLocationId', 'business_locations'],
    ['traceabilityAgentId', 'traceability_agents'],
    ['companyId', 'companies'],
  ] as const) {
    const [[row]] = await t.pool.query<RowDataPacket[]>(`SELECT id FROM ${table} ORDER BY id LIMIT 1`);
    ref[key] = row!.id;
  }
});
afterAll(async () => {
  await t.close();
});

/** Creates a record with two weight corrections: events #1 CREATE, #2 and #3 UPDATE. */
async function recordWithHistory(): Promise<number> {
  const created = (
    await request(t.app, supervisor, {
      method: 'POST',
      url: '/api/production',
      payload: {
        tagNumber: `AUD-${randomUUID().slice(0, 8)}`,
        productionDate: '2026-10-01',
        weightKg: '100',
        operatorRepresentative: 'Jean Mugabo',
        ...ref,
      },
    })
  ).json();
  let record = created;
  for (const [weight, reason] of [
    ['101', 'Scale recalibrated'],
    ['102', 'Second weighing'],
  ]) {
    record = (
      await request(t.app, supervisor, {
        method: 'PUT',
        url: `/api/production/${record.id}`,
        payload: {
          productionCode: record.productionCode,
          tagNumber: record.tagNumber,
          productionDate: record.productionDate,
          weightKg: weight,
          mineralTypeId: record.mineralType.id,
          businessLocationId: record.businessLocation.id,
          traceabilityAgentId: record.traceabilityAgent.id,
          companyId: record.company.id,
          operatorRepresentative: record.operatorRepresentative,
          version: record.version,
          reason,
        },
      })
    ).json();
  }
  return created.id;
}

const verify = async (id: number) =>
  (await request(t.app, auditor, { method: 'GET', url: `/api/production/${id}/verify` })).json();

const triggerSql = readFileSync(
  new URL('../../src/db/migrations/0006_production.sql', import.meta.url),
  'utf8',
)
  .split(/^--> statement-breakpoint$/m)
  .map((s) => s.trim())
  .filter((s) => s.startsWith('CREATE TRIGGER'));

async function withTriggersDisabled(fn: () => Promise<unknown>) {
  await t.pool.query('DROP TRIGGER trg_audit_no_update');
  await t.pool.query('DROP TRIGGER trg_audit_no_delete');
  try {
    await fn();
  } finally {
    for (const statement of triggerSql) await t.pool.query(statement);
  }
}

describe('tamper detection', () => {
  it('blocks edits and deletes on audit events at the database level', async () => {
    const id = await recordWithHistory();
    await expect(
      t.pool.query('UPDATE production_audit_event SET reason = ? WHERE production_id = ?', ['x', id]),
    ).rejects.toThrow(/append-only/);
    await expect(
      t.pool.query('DELETE FROM production_audit_event WHERE production_id = ?', [id]),
    ).rejects.toThrow(/append-only/);
  });

  it('detects a record changed directly in the database', async () => {
    const id = await recordWithHistory();
    await t.pool.query('UPDATE production SET weight_kg = 999 WHERE id = ?', [id]);
    expect(await verify(id)).toMatchObject({ status: 'tampered', failure: { reason: 'STATE_MISMATCH' } });
  });

  it('detects an edited audit event', async () => {
    const id = await recordWithHistory();
    await withTriggersDisabled(() =>
      t.pool.query(
        "UPDATE production_audit_event SET reason = 'Routine' WHERE production_id = ? AND seq = 2",
        [id],
      ),
    );
    expect(await verify(id)).toMatchObject({
      status: 'tampered',
      failure: { seq: 2, reason: 'HASH_MISMATCH' },
    });
  });

  it('detects a history rewritten by someone who does not have the secret', async () => {
    const id = await recordWithHistory();
    const [rows] = await t.pool.query<RowDataPacket[]>(
      'SELECT * FROM production_audit_event WHERE production_id = ? ORDER BY seq',
      [id],
    );
    let last: StoredEvent | null = null;
    const forged = rows.map((r) => {
      const changes = (r.changes as FieldChange[]).map((c) =>
        c.field === 'weightKg' ? { ...c, to: '102.000' } : c,
      );
      last = nextEvent('a-guessed-secret-a-guessed-secret-1234', last, {
        productionId: id,
        eventType: r.event_type,
        changes,
        reason: r.reason,
        actorId: r.actor_id,
        actorLabel: r.actor_label,
        occurredAt: new Date(r.occurred_at).toISOString(),
      });
      return last;
    });
    await withTriggersDisabled(async () => {
      for (const e of forged) {
        await t.pool.query(
          'UPDATE production_audit_event SET changes = ?, prev_hash = ?, hash = ? WHERE production_id = ? AND seq = ?',
          [JSON.stringify(e.changes), e.prevHash, e.hash, id, e.seq],
        );
      }
    });
    expect(await verify(id)).toMatchObject({
      status: 'tampered',
      failure: { seq: 1, reason: 'HASH_MISMATCH' },
    });
  });

  it('detects an event deleted from the middle', async () => {
    const id = await recordWithHistory();
    await withTriggersDisabled(() =>
      t.pool.query('DELETE FROM production_audit_event WHERE production_id = ? AND seq = 2', [id]),
    );
    expect(await verify(id)).toMatchObject({
      status: 'tampered',
      failure: { seq: 3, reason: 'SEQUENCE_GAP' },
    });
  });

  it('detects the latest event being deleted', async () => {
    const id = await recordWithHistory();
    await withTriggersDisabled(() =>
      t.pool.query('DELETE FROM production_audit_event WHERE production_id = ? AND seq = 3', [id]),
    );
    expect(await verify(id)).toMatchObject({ status: 'tampered', failure: { reason: 'STATE_MISMATCH' } });
  });

  it('never reports tampering for a record that is being edited at the same time', async () => {
    const id = await recordWithHistory();
    let record = (await request(t.app, supervisor, { method: 'GET', url: `/api/production/${id}` })).json();
    const statuses: string[] = [];
    for (let round = 0; round < 15; round++) {
      const edit = request(t.app, supervisor, {
        method: 'PUT',
        url: `/api/production/${id}`,
        payload: {
          productionCode: record.productionCode,
          tagNumber: record.tagNumber,
          productionDate: record.productionDate,
          weightKg: String(200 + round),
          mineralTypeId: record.mineralType.id,
          businessLocationId: record.businessLocation.id,
          traceabilityAgentId: record.traceabilityAgent.id,
          companyId: record.company.id,
          operatorRepresentative: record.operatorRepresentative,
          version: record.version,
          reason: `Round ${round} correction`,
        },
      });
      const checks = Array.from({ length: 4 }, () => verify(id));
      const [edited, ...results] = await Promise.all([edit, ...checks]);
      record = edited.json();
      statuses.push(...results.map((r) => r.status));
    }
    expect(statuses.filter((s) => s !== 'intact')).toEqual([]);
  });
});
