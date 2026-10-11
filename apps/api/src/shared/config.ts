import { z } from 'zod';

const timeZone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Unknown IANA time zone');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'Must be at least 32 characters'),
  AUDIT_SECRET: z.string().min(32, 'Must be at least 32 characters'),
  STORAGE_DIR: z.string().default('./storage'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
  OCR_LANGS: z
    .string()
    .regex(/^[a-z_]+(\+[a-z_]+)*$/)
    .default('eng+fra'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  APP_TIMEZONE: timeZone.default('Africa/Kigali'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Number of reverse proxies in front of the API whose X-Forwarded-For entry can be trusted (0 = none). */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  /** Defaults to true in production; set to false only for plain-HTTP local runs. */
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  /** Text-recognition jobs allowed at once; each one is CPU-bound. */
  OCR_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  /** Upper bound for reading one report, kept below the web server's proxy timeout. */
  EXTRACTION_BUDGET_SECONDS: z.coerce.number().int().min(10).max(600).default(150),
});

const withDefaults = (c: z.infer<typeof schema>) => ({
  ...c,
  COOKIE_SECURE: c.COOKIE_SECURE ? c.COOKIE_SECURE === 'true' : c.NODE_ENV === 'production',
});

export type Config = ReturnType<typeof withDefaults>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return withDefaults(result.data);
}
