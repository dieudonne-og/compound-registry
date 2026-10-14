import { z } from 'zod';
import { weightKgValue } from './decimal';
import { pageQuery } from './pagination';

export const CRITICAL_FIELDS = ['productionCode', 'tagNumber', 'weightKg', 'mineralTypeId'] as const;
export type CriticalField = (typeof CRITICAL_FIELDS)[number];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date.format')
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  }, 'validation.date.real');

/** `key` is the shared message key used both when the reference is missing and when it is not a number. */
const refId = (key: string) => z.number({ required_error: key, invalid_type_error: key }).int().positive();

export const tagNumber = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, 'validation.tag.required')
  .max(32, 'validation.tag.max')
  .regex(/^[A-Z0-9][A-Z0-9\-_/.]*$/, 'validation.tag.chars');

export const productionCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{2,31}$/, 'validation.code.format');

const baseFields = {
  tagNumber,
  productionDate: isoDate,
  mineralTypeId: refId('validation.reference.mineralTypeId'),
  weightKg: weightKgValue,
  businessLocationId: refId('validation.reference.businessLocationId'),
  traceabilityAgentId: refId('validation.reference.traceabilityAgentId'),
  companyId: refId('validation.reference.companyId'),
  operatorRepresentative: z.string().trim().min(2, 'validation.representative').max(120),
};

export const createProductionInput = z.object({ productionCode: productionCode.optional(), ...baseFields });
export type CreateProductionInput = z.infer<typeof createProductionInput>;

export const updateProductionInput = z.object({
  productionCode,
  ...baseFields,
  version: z.number().int().positive(),
  reason: z.string().trim().min(5, 'validation.reason.min').max(500).optional(),
});
export type UpdateProductionInput = z.infer<typeof updateProductionInput>;

export const PRODUCTION_SORTS = [
  'createdAt',
  '-createdAt',
  'productionDate',
  '-productionDate',
  'weightKg',
  '-weightKg',
  'tagNumber',
  '-tagNumber',
] as const;

export const productionListQuery = pageQuery.extend({
  q: z.string().trim().max(64).optional(),
  mineralTypeId: z.coerce.number().int().positive().optional(),
  companyId: z.coerce.number().int().positive().optional(),
  locationId: z.coerce.number().int().positive().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  sort: z.enum(PRODUCTION_SORTS).default('-createdAt'),
});
export type ProductionListQuery = z.infer<typeof productionListQuery>;

const named = z.object({ id: z.number().int(), name: z.string() });

export const productionRecord = z.object({
  id: z.number().int(),
  productionCode: z.string(),
  tagNumber: z.string(),
  productionDate: z.string(),
  weightKg: z.string(),
  mineralType: named.extend({ code: z.string() }),
  businessLocation: named,
  traceabilityAgent: named,
  company: named,
  operatorRepresentative: z.string(),
  version: z.number().int(),
  createdBy: named,
  createdAt: z.string(),
  updatedBy: named.nullable(),
  updatedAt: z.string(),
});
export type ProductionRecord = z.infer<typeof productionRecord>;

const changeValue = z.union([z.string(), z.number()]);

export const fieldChange = z.object({
  field: z.enum(CRITICAL_FIELDS),
  from: changeValue.nullable(),
  to: changeValue,
});
export type FieldChange = z.infer<typeof fieldChange>;

export const auditEventView = z.object({
  seq: z.number().int(),
  eventType: z.enum(['CREATE', 'UPDATE']),
  changes: z.array(fieldChange.extend({ fromLabel: z.string().nullable(), toLabel: z.string() })),
  reason: z.string().nullable(),
  actor: z.object({ id: z.number().int(), label: z.string() }),
  occurredAt: z.string(),
  prevHash: z.string(),
  hash: z.string(),
});
export type AuditEventView = z.infer<typeof auditEventView>;

export const VERIFY_FAILURES = [
  'NO_EVENTS',
  'MISSING_CREATE',
  'SEQUENCE_GAP',
  'PREV_HASH_MISMATCH',
  'HASH_MISMATCH',
  'STATE_MISMATCH',
] as const;

export const verifyResult = z.object({
  status: z.enum(['intact', 'tampered']),
  eventsChecked: z.number().int(),
  failure: z
    .object({
      seq: z.number().int().nullable(),
      reason: z.enum(VERIFY_FAILURES),
      /** English text; screens translate from `reason` and `params`. */
      message: z.string(),
      params: z.record(z.union([z.string(), z.number()])).optional(),
    })
    .optional(),
});
export type VerifyResult = z.infer<typeof verifyResult>;
