import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import type { ProductionRecord } from '@cr/contracts';
import { createTestApp, login, request, type Session, type TestApp } from '../helpers';

let t: TestApp;
let admin: Session, supervisor: Session, operator: Session, auditor: Session;
let ref: {
  mineralTypeId: number;
  otherMineralId: number;
  businessLocationId: number;
  traceabilityAgentId: number;
  companyId: number;
};

beforeAll(async () => {
  t = await createTestApp();
  [admin, supervisor, operator, auditor] = (await Promise.all(
    (['admin', 'supervisor', 'operator', 'auditor'] as const).map((r) => login(t.app, r)),
  )) as [Session, Session, Session, Session];
  const first = async (table: string) => {
    const [rows] = await t.pool.query<RowDataPacket[]>(`SELECT id FROM ${table} ORDER BY id LIMIT 2`);
    return rows.map((r) => r.id as number);
  };
  const [minerals, locations, agents, firms] = await Promise.all(
    ['mineral_types', 'business_locations', 'traceability_agents', 'companies'].map(first),
  );
  ref = {
    mineralTypeId: minerals![0]!,
    otherMineralId: minerals![1]!,
    businessLocationId: locations![0]!,
    traceabilityAgentId: agents![0]!,
    companyId: firms![0]!,
  };
});
afterAll(async () => {
  await t.close();
});
afterEach(() => {
  vi.useRealTimers();
});

const body = (overrides: Record<string, unknown> = {}) => ({
  tagNumber: `T-${randomUUID().slice(0, 8)}`,
  productionDate: '2026-10-01',
  weightKg: '320.3',
  operatorRepresentative: 'Jean Mugabo',
  ...ref,
  ...overrides,
});
const create = (s: Session, payload: object, headers: Record<string, string> = {}) =>
  request(t.app, s, { method: 'POST', url: '/api/production', payload, headers });
const update = (s: Session, id: number, payload: object) =>
  request(t.app, s, { method: 'PUT', url: `/api/production/${id}`, payload });
const asUpdate = (r: ProductionRecord, overrides: Record<string, unknown> = {}) => ({
  productionCode: r.productionCode,
  tagNumber: r.tagNumber,
  productionDate: r.productionDate,
  weightKg: r.weightKg,
  mineralTypeId: r.mineralType.id,
  businessLocationId: r.businessLocation.id,
  traceabilityAgentId: r.traceabilityAgent.id,
  companyId: r.company.id,
  operatorRepresentative: r.operatorRepresentative,
  version: r.version,
  ...overrides,
});
const verify = async (id: number) =>
  (await request(t.app, auditor, { method: 'GET', url: `/api/production/${id}/verify` })).json();

describe('creating records', () => {
  it('creates a record with a generated ID and a CREATE audit event', async () => {
    const res = await create(operator, body());
    expect(res.statusCode).toBe(201);
    const record = res.json();
    expect(record.productionCode).toMatch(/^PRD-\d{4}-\d{6}$/);
    expect(record).toMatchObject({
      weightKg: '320.300',
      version: 1,
      createdBy: { name: 'Grace Mukamana' },
      updatedBy: null,
    });
    const history = (
      await request(t.app, auditor, { method: 'GET', url: `/api/production/${record.id}/history` })
    ).json();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ seq: 1, eventType: 'CREATE', prevHash: '0'.repeat(64) });
    expect(history[0].changes.map((c: { field: string }) => c.field)).toEqual([
      'productionCode',
      'tagNumber',
      'weightKg',
      'mineralTypeId',
    ]);
    expect(await verify(record.id)).toEqual({ status: 'intact', eventsChecked: 1 });
  });

  it('validates every field on the server', async () => {
    const res = await create(operator, body({ weightKg: '0', companyId: undefined, mineralTypeId: 999999 }));
    expect(res.statusCode).toBe(422);
    expect(Object.keys(res.json().error.details.fields)).toEqual(
      expect.arrayContaining(['weightKg', 'companyId']),
    );
    const ref404 = await create(operator, body({ mineralTypeId: 999999 }));
    expect(ref404.json().error.details.fields).toHaveProperty('mineralTypeId');
  });

  it('accepts today in the business time zone even when UTC is still yesterday', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T22:30:00Z')); // 00:30 on 11 Oct in Kigali
    const s = await login(t.app, 'operator'); // token issued at the faked time
    expect((await create(s, body({ productionDate: '2026-10-11' }))).statusCode).toBe(201);
    const future = await create(s, body({ productionDate: '2026-10-12' }));
    expect(future.statusCode).toBe(422);
    expect(future.json().error.details.fields.productionDate).toMatch(/future/);
  });

  it('rejects duplicate tag numbers regardless of case', async () => {
    await create(operator, body({ tagNumber: 'dup-001' }));
    const res = await create(operator, body({ tagNumber: 'DUP-001' }));
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('TAG_NUMBER_TAKEN');
  });

  it('replays an idempotent retry instead of creating twice', async () => {
    const key = randomUUID();
    const payload = body();
    const a = await create(operator, payload, { 'idempotency-key': key });
    const b = await create(operator, payload, { 'idempotency-key': key });
    expect(b.statusCode).toBe(201);
    expect(b.headers['idempotent-replayed']).toBe('true');
    expect(b.json().id).toBe(a.json().id);
    const c = await create(operator, { ...payload, weightKg: '1' }, { 'idempotency-key': key });
    expect(c.json().error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('forbids auditors from creating', async () => {
    expect((await create(auditor, body())).statusCode).toBe(403);
  });
});

describe('updating records', () => {
  it('lets operators edit non-critical fields of their own records without an audit event', async () => {
    const record = (await create(operator, body())).json();
    const res = await update(
      operator,
      record.id,
      asUpdate(record, { operatorRepresentative: 'Claudine Ingabire' }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ version: 2, updatedBy: { name: 'Grace Mukamana' } });
    const history = (
      await request(t.app, auditor, { method: 'GET', url: `/api/production/${record.id}/history` })
    ).json();
    expect(history).toHaveLength(1);
  });

  it('keeps records editable after one of their references is retired', async () => {
    const company = (
      await request(t.app, admin, {
        method: 'POST',
        url: '/api/reference/companies',
        payload: { name: `Retired Co ${randomUUID().slice(0, 6)}` },
      })
    ).json();
    const record = (await create(operator, body({ companyId: company.id }))).json();
    await request(t.app, admin, {
      method: 'PATCH',
      url: `/api/reference/companies/${company.id}`,
      payload: { active: false },
    });
    const res = await update(
      operator,
      record.id,
      asUpdate(record, { operatorRepresentative: 'Claudine Ingabire' }),
    );
    expect(res.statusCode).toBe(200);
    const moved = await update(
      operator,
      record.id,
      asUpdate(res.json(), { companyId: company.id, businessLocationId: ref.businessLocationId }),
    );
    expect(moved.statusCode).toBe(200); // unchanged reference stays valid
  });

  it('stops operators from editing other people’s records or critical fields', async () => {
    const mine = (await create(operator, body())).json();
    const theirs = (await create(supervisor, body())).json();
    expect(
      (await update(operator, theirs.id, asUpdate(theirs, { operatorRepresentative: 'X Y' }))).statusCode,
    ).toBe(403);
    expect(
      (await update(operator, mine.id, asUpdate(mine, { weightKg: '400', reason: 'Re-weighed' }))).statusCode,
    ).toBe(403);
  });

  it('requires a reason for critical changes and records from/to values', async () => {
    const record = (await create(operator, body())).json();
    const noReason = await update(supervisor, record.id, asUpdate(record, { weightKg: '318.5' }));
    expect(noReason.statusCode).toBe(422);
    expect(noReason.json().error.code).toBe('REASON_REQUIRED');

    const res = await update(
      supervisor,
      record.id,
      asUpdate(record, {
        weightKg: '318.5',
        mineralTypeId: ref.otherMineralId,
        reason: 'Re-weighed at warehouse',
      }),
    );
    expect(res.statusCode).toBe(200);
    const history = (
      await request(t.app, auditor, { method: 'GET', url: `/api/production/${record.id}/history` })
    ).json();
    expect(history[1]).toMatchObject({
      seq: 2,
      eventType: 'UPDATE',
      reason: 'Re-weighed at warehouse',
      actor: { label: 'Eric Habimana (supervisor)' },
      changes: [
        { field: 'weightKg', from: '320.300', to: '318.500', fromLabel: '320.300 kg', toLabel: '318.500 kg' },
        { field: 'mineralTypeId', from: ref.mineralTypeId, to: ref.otherMineralId },
      ],
    });
    expect(history[1].prevHash).toBe(history[0].hash);
    expect(await verify(record.id)).toEqual({ status: 'intact', eventsChecked: 2 });
  });

  it('reserves production ID changes for admins', async () => {
    const record = (await create(operator, body())).json();
    const code = `CUSTOM-${randomUUID().slice(0, 6)}`.toUpperCase();
    expect(
      (
        await update(
          supervisor,
          record.id,
          asUpdate(record, { productionCode: code, reason: 'Align with export ID' }),
        )
      ).statusCode,
    ).toBe(403);
    const res = await update(
      admin,
      record.id,
      asUpdate(record, { productionCode: code, reason: 'Align with export ID' }),
    );
    expect(res.json().productionCode).toBe(code);
  });

  it('rejects stale versions', async () => {
    const record = (await create(operator, body())).json();
    await update(supervisor, record.id, asUpdate(record, { operatorRepresentative: 'A B' }));
    const stale = await update(supervisor, record.id, asUpdate(record, { operatorRepresentative: 'C D' }));
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error).toMatchObject({ code: 'VERSION_CONFLICT', details: { currentVersion: 2 } });
  });

  it('lets exactly one of two simultaneous edits win and keeps the chain linear', async () => {
    const record = (await create(operator, body())).json();
    const [a, b] = await Promise.all([
      update(supervisor, record.id, asUpdate(record, { weightKg: '100', reason: 'First correction' })),
      update(admin, record.id, asUpdate(record, { weightKg: '200', reason: 'Second correction' })),
    ]);
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409]);
    const [seqs] = await t.pool.query<RowDataPacket[]>(
      'SELECT seq FROM production_audit_event WHERE production_id = ? ORDER BY seq',
      [record.id],
    );
    expect(seqs.map((r) => r.seq)).toEqual([1, 2]);
    expect((await verify(record.id)).status).toBe('intact');
  });
});

describe('listing and export', () => {
  it('filters, paginates and sorts', async () => {
    const tag = `FIND-${randomUUID().slice(0, 6)}`.toUpperCase();
    await create(operator, body({ tagNumber: tag, weightKg: '10' }));
    const res = await request(t.app, auditor, {
      method: 'GET',
      url: `/api/production?q=${tag.toLowerCase()}&pageSize=5&sort=-weightKg`,
    });
    expect(res.json()).toMatchObject({ total: 1, page: 1, pageSize: 5, items: [{ tagNumber: tag }] });
  });

  it('exports CSV with formula injection neutralised', async () => {
    const tag = `CSV-${randomUUID().slice(0, 6)}`;
    await create(operator, body({ tagNumber: tag, operatorRepresentative: '=HYPERLINK("http://x")' }));
    const res = await request(t.app, auditor, { method: 'GET', url: `/api/production/export.csv?q=${tag}` });
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.body).toContain('Production ID,Tag Number');
    expect(res.body).toContain(`"'=HYPERLINK(""http://x"")"`);
  });
});
