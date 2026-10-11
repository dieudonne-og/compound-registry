import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RowDataPacket } from 'mysql2';
import { createTestApp, login, multipart, request, type Session, type TestApp } from '../helpers';

const fixture = (n: string) => readFileSync(new URL(`../fixtures/reports/${n}`, import.meta.url));
const textPdf = fixture('analysis-certificate-text.pdf');

let t: TestApp;
let operator: Session;
let auditor: Session;
beforeAll(async () => {
  t = await createTestApp();
  operator = await login(t.app, 'operator');
  auditor = await login(t.app, 'auditor');
});
afterAll(async () => {
  await t.close();
});

async function extract(
  session: Session,
  file: { name: string; data: Buffer; type: string },
  purchaseId = 'PO-2026-001',
) {
  const body = await multipart({ purchaseId }, file);
  return request(t.app, session, { method: 'POST', url: '/api/compounds/extract', ...body });
}

describe('compound extraction and storage', () => {
  it('extracts a text-based PDF for review without saving a Compound row', async () => {
    const [[before]] = await t.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM `Compound`');
    const res = await extract(operator, { name: 'cert.pdf', data: textPdf, type: 'application/pdf' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ method: 'text-layer', purchaseId: 'PO-2026-001', duplicateOf: null });
    expect(body.fields.find((f: { column: string }) => f.column === 'sn_percent').value).toBe('58.7200');
    const [[after]] = await t.pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM `Compound`');
    expect(after!.n).toBe(before!.n);
  });

  it('warns when the same file is uploaded again', async () => {
    const res = await extract(operator, { name: 'cert.pdf', data: textPdf, type: 'application/pdf' });
    expect(res.json().warnings.map((w: { code: string }) => w.code)).toContain('DUPLICATE_FILE');
  });

  it('saves confirmed values and keeps everything else NULL', async () => {
    const extraction = (
      await extract(operator, { name: 'cert.pdf', data: textPdf, type: 'application/pdf' })
    ).json();
    const res = await request(t.app, operator, {
      method: 'POST',
      url: '/api/compounds',
      payload: {
        extractionId: extraction.extractionId,
        purchaseId: 'PO-2026-001',
        values: { sn_percent: '58.72', wo_percent: null },
      },
    });
    expect(res.statusCode).toBe(201);
    const [[row]] = await t.pool.query<RowDataPacket[]>('SELECT * FROM `Compound` WHERE id = ?', [
      res.json().id,
    ]);
    expect(row).toMatchObject({
      purchase_id: 'PO-2026-001',
      sn_percent: '58.7200',
      wo_percent: null,
      fe_percent: null,
    });
    expect(row!.file_path).toMatch(/\.pdf$/);
    expect(row!.extraction_date).toBeInstanceOf(Date);

    const again = await request(t.app, operator, {
      method: 'POST',
      url: '/api/compounds',
      payload: { extractionId: extraction.extractionId, purchaseId: 'PO-2026-001', values: {} },
    });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('ALREADY_CONFIRMED');
  });

  it('rejects values that do not fit DECIMAL(10,4) or the 0–100 range', async () => {
    const extraction = (
      await extract(operator, { name: 'cert.pdf', data: textPdf, type: 'application/pdf' })
    ).json();
    const res = await request(t.app, operator, {
      method: 'POST',
      url: '/api/compounds',
      payload: {
        extractionId: extraction.extractionId,
        purchaseId: 'PO-1',
        values: { sn_percent: '12.34567', fe_percent: '101' },
      },
    });
    expect(res.statusCode).toBe(422);
    expect(Object.keys(res.json().error.details.fields)).toEqual(
      expect.arrayContaining(['values.sn_percent', 'values.fe_percent']),
    );
  });

  it('refuses expired extractions', async () => {
    const extraction = (
      await extract(operator, { name: 'cert.pdf', data: textPdf, type: 'application/pdf' })
    ).json();
    await t.pool.query(
      'UPDATE compound_extraction SET expires_at = NOW(3) - INTERVAL 1 MINUTE WHERE id = ?',
      [extraction.extractionId],
    );
    const res = await request(t.app, operator, {
      method: 'POST',
      url: '/api/compounds',
      payload: { extractionId: extraction.extractionId, purchaseId: 'PO-1', values: {} },
    });
    expect(res.statusCode).toBe(410);
  });

  it('rejects files whose content does not match an allowed type', async () => {
    const res = await extract(operator, {
      name: 'fake.pdf',
      data: Buffer.from('just text'),
      type: 'application/pdf',
    });
    expect(res.statusCode).toBe(415);
    expect(res.json().error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('rejects files above the size limit', async () => {
    const big = Buffer.concat([textPdf, Buffer.alloc(3 * 1024 * 1024)]);
    const res = await extract(operator, { name: 'big.pdf', data: big, type: 'application/pdf' });
    expect(res.statusCode).toBe(413);
    expect(res.json().error.code).toBe('FILE_TOO_LARGE');
  });

  it('requires a valid purchase ID', async () => {
    const res = await extract(operator, { name: 'cert.pdf', data: textPdf, type: 'application/pdf' }, '');
    expect(res.statusCode).toBe(422);
    expect(res.json().error.details.fields.purchaseId).toBeTruthy();
  });

  it('does not let auditors upload, but lets them read and download', async () => {
    expect(
      (await extract(auditor, { name: 'cert.pdf', data: textPdf, type: 'application/pdf' })).statusCode,
    ).toBe(403);
    const list = await request(t.app, auditor, { method: 'GET', url: '/api/compounds?purchaseId=PO-2026' });
    expect(list.statusCode).toBe(200);
    expect(list.json().items[0]).toMatchObject({ purchaseId: 'PO-2026-001', method: 'text-layer' });
    const file = await request(t.app, auditor, {
      method: 'GET',
      url: `/api/compounds/${list.json().items[0].id}/file`,
    });
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(file.headers['x-content-type-options']).toBe('nosniff');
  });

  it('extracts a scanned image-only PDF with OCR', async () => {
    const res = await extract(operator, {
      name: 'scan.pdf',
      data: fixture('analysis-report-image-only.pdf'),
      type: 'application/pdf',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().method).toBe('ocr');
    expect(res.json().fields.find((f: { column: string }) => f.column === 'sn_percent').value).toBe(
      '57.5700',
    );
  });
});
