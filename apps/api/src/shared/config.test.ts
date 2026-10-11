import { describe, expect, it } from 'vitest';
import { loadConfig } from './config';

const base = {
  DATABASE_URL: 'mysql://u:p@localhost:3306/db',
  JWT_SECRET: 'x'.repeat(32),
  AUDIT_SECRET: 'y'.repeat(32),
};

describe('loadConfig', () => {
  it('applies defaults', () => {
    const c = loadConfig(base);
    expect(c.PORT).toBe(3000);
    expect(c.MAX_UPLOAD_MB).toBe(10);
    expect(c.APP_TIMEZONE).toBe('Africa/Kigali');
  });
  it('lists every invalid variable in one error', () => {
    expect(() => loadConfig({ DATABASE_URL: 'nope', JWT_SECRET: 'short' })).toThrow(
      /DATABASE_URL[\s\S]*JWT_SECRET[\s\S]*AUDIT_SECRET/,
    );
  });
  it('rejects an unknown time zone', () => {
    expect(() => loadConfig({ ...base, APP_TIMEZONE: 'Mars/Olympus' })).toThrow(/APP_TIMEZONE/);
  });
});
