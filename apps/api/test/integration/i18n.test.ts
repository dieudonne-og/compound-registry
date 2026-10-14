import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, request, type Session, type TestApp } from '../helpers';

let t: TestApp;
let operator: Session;
beforeAll(async () => {
  t = await createTestApp();
  operator = await login(t.app, 'operator');
});
afterAll(async () => {
  await t.close();
});

describe('localised API messages', () => {
  it('answers in French when asked, with the same error codes', async () => {
    const res = await request(t.app, operator, {
      method: 'POST',
      url: '/api/production',
      headers: { 'accept-language': 'fr-FR,fr;q=0.9' },
      payload: {
        tagNumber: '',
        productionDate: '2026-10-01',
        weightKg: '0',
        mineralTypeId: 1,
        businessLocationId: 1,
        traceabilityAgentId: 1,
        companyId: 1,
        operatorRepresentative: 'Jean Mugabo',
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('VALIDATION_FAILED');
    expect(res.json().error.message).toMatch(/attention|champs/i);
    expect(res.json().error.details.fields.weightKg).toMatch(/supérieur|zéro/i);
  });

  it('keeps English for other languages', async () => {
    const res = await request(t.app, operator, {
      method: 'GET',
      url: '/api/production/999999',
      headers: { 'accept-language': 'de-DE' },
    });
    expect(res.json().error.message).toBe('Production record was not found.');
  });

  it('translates messages raised by the service layer', async () => {
    const res = await request(t.app, operator, {
      method: 'GET',
      url: '/api/production/999999',
      headers: { 'accept-language': 'fr' },
    });
    expect(res.json().error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Enregistrement de production introuvable.',
    });
  });
});
