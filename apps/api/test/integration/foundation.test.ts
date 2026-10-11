import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RowDataPacket } from 'mysql2';
import { createTestApp, type TestApp } from '../helpers';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

describe('foundation', () => {
  it('reports health', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'ok' });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('returns the standard error shape for unknown routes', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatchObject({ code: 'NOT_FOUND', requestId: expect.any(String) });
  });

  it('auto-increments Compound.id and keeps missing values NULL', async () => {
    await t.pool.query(
      "INSERT INTO `Compound` (purchase_id, sn_percent) VALUES ('P-1', 57.57), ('P-2', NULL)",
    );
    const [rows] = await t.pool.query<RowDataPacket[]>(
      "SELECT id, sn_percent, fe2o3_percent FROM `Compound` WHERE purchase_id IN ('P-1','P-2') ORDER BY id",
    );
    expect(rows[1]!.id).toBe(rows[0]!.id + 1);
    expect(rows[0]!.sn_percent).toBe('57.5700');
    expect(rows[0]!.fe2o3_percent).toBeNull();
    expect(rows[1]!.sn_percent).toBeNull();
  });

  it('keeps DATE columns as plain strings with no time-zone shift', async () => {
    const [rows] = await t.pool.query<RowDataPacket[]>("SELECT CAST('2026-10-11' AS DATE) AS d");
    expect(rows[0]!.d).toBe('2026-10-11');
  });

  it('runs every database session in UTC so SQL and application timestamps agree', async () => {
    const [rows] = await t.pool.query<RowDataPacket[]>('SELECT @@session.time_zone AS tz');
    expect(rows[0]!.tz).toBe('+00:00');
  });

  it('installs append-only triggers on the audit table', async () => {
    const [triggers] = await t.pool.query<RowDataPacket[]>(
      "SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE = 'production_audit_event'",
    );
    expect(triggers.map((r) => r.TRIGGER_NAME).sort()).toEqual([
      'trg_audit_no_delete',
      'trg_audit_no_update',
    ]);
  });

  it('seeds reference data', async () => {
    const [rows] = await t.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM mineral_types');
    expect(Number(rows[0]!.n)).toBe(5);
  });
});
