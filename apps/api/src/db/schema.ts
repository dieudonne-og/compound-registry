import {
  bigint,
  boolean,
  char,
  date,
  datetime,
  decimal,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  mediumtext,
} from 'drizzle-orm/mysql-core';
import { COMPOUND_COLUMNS, ROLES, type CompoundColumn } from '@cr/contracts';

const id = () => bigint('id', { mode: 'number' }).autoincrement().primaryKey();
const ref = (name: string) => bigint(name, { mode: 'number' });
const ms = (name: string) => datetime(name, { mode: 'date', fsp: 3 });

/** One DECIMAL(10,4) column per catalog entry; the catalog is the single source of the column list. */
const percentColumns = Object.fromEntries(
  COMPOUND_COLUMNS.map((c) => [c, decimal({ precision: 10, scale: 4 })]),
) as unknown as Record<CompoundColumn, ReturnType<typeof decimal>>;

export const compound = mysqlTable('Compound', {
  id: int('id').autoincrement().primaryKey(),
  purchaseId: varchar('purchase_id', { length: 20 }).notNull(),
  filePath: varchar('file_path', { length: 255 }),
  extractionDate: timestamp('extraction_date', { mode: 'date' }),
  ...percentColumns,
});

export const users = mysqlTable('users', {
  id: id(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 190 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: mysqlEnum('role', ROLES).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: ms('created_at').notNull(),
});

export const refreshTokens = mysqlTable('refresh_tokens', {
  id: id(),
  userId: ref('user_id').notNull(),
  tokenHash: char('token_hash', { length: 64 }).notNull(),
  expiresAt: ms('expires_at').notNull(),
  revokedAt: ms('revoked_at'),
  replacedBy: ref('replaced_by'),
  createdAt: ms('created_at').notNull(),
});

const referenceTable = <N extends string>(name: N) =>
  mysqlTable(name, {
    id: id(),
    name: varchar('name', { length: 120 }).notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: ms('created_at').notNull(),
  });

export const companies = referenceTable('companies');
export const businessLocations = referenceTable('business_locations');
export const traceabilityAgents = referenceTable('traceability_agents');
export const mineralTypes = mysqlTable('mineral_types', {
  id: id(),
  code: varchar('code', { length: 8 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: ms('created_at').notNull(),
});

export const compoundExtraction = mysqlTable('compound_extraction', {
  id: char('id', { length: 36 }).primaryKey(),
  compoundId: int('compound_id'),
  status: mysqlEnum('status', ['pending', 'confirmed', 'expired']).notNull(),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 64 }).notNull(),
  sizeBytes: int('size_bytes').notNull(),
  sha256: char('sha256', { length: 64 }).notNull(),
  storageKey: varchar('storage_key', { length: 255 }).notNull(),
  method: mysqlEnum('method', ['text-layer', 'ocr', 'hybrid']).notNull(),
  overallConfidence: decimal('overall_confidence', { precision: 5, scale: 4 }).notNull(),
  rawText: mediumtext('raw_text').notNull(),
  result: json('result').notNull(),
  createdBy: ref('created_by').notNull(),
  createdAt: ms('created_at').notNull(),
  expiresAt: ms('expires_at').notNull(),
});

export const production = mysqlTable('production', {
  id: id(),
  productionCode: varchar('production_code', { length: 32 }).notNull(),
  tagNumber: varchar('tag_number', { length: 32 }).notNull(),
  productionDate: date('production_date', { mode: 'string' }).notNull(),
  mineralTypeId: ref('mineral_type_id').notNull(),
  weightKg: decimal('weight_kg', { precision: 12, scale: 3 }).notNull(),
  businessLocationId: ref('business_location_id').notNull(),
  traceabilityAgentId: ref('traceability_agent_id').notNull(),
  companyId: ref('company_id').notNull(),
  operatorRepresentative: varchar('operator_representative', { length: 120 }).notNull(),
  version: int('version').notNull().default(1),
  createdBy: ref('created_by').notNull(),
  updatedBy: ref('updated_by'),
  createdAt: ms('created_at').notNull(),
  updatedAt: ms('updated_at').notNull(),
});

export const productionAuditEvent = mysqlTable('production_audit_event', {
  id: id(),
  productionId: ref('production_id').notNull(),
  seq: int('seq').notNull(),
  eventType: mysqlEnum('event_type', ['CREATE', 'UPDATE']).notNull(),
  changes: json('changes').notNull(),
  reason: text('reason'),
  actorId: ref('actor_id').notNull(),
  actorLabel: varchar('actor_label', { length: 160 }).notNull(),
  occurredAt: ms('occurred_at').notNull(),
  prevHash: char('prev_hash', { length: 64 }).notNull(),
  hash: char('hash', { length: 64 }).notNull(),
});

export const idempotencyKeys = mysqlTable('idempotency_keys', {
  key: varchar('idem_key', { length: 64 }).notNull(),
  userId: ref('user_id').notNull(),
  requestHash: char('request_hash', { length: 64 }).notNull(),
  statusCode: int('status_code'),
  response: json('response'),
  createdAt: ms('created_at').notNull(),
});
