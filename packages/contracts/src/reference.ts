import { z } from 'zod';

export const REFERENCE_KINDS = ['companies', 'locations', 'agents', 'mineral-types'] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];

export const referenceItem = z.object({
  id: z.number().int(),
  name: z.string(),
  code: z.string().nullable(),
  active: z.boolean(),
});
export type ReferenceItem = z.infer<typeof referenceItem>;

export const referenceInput = z.object({
  name: z.string().trim().min(2).max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,8}$/)
    .optional(),
});
export const referencePatch = referenceInput
  .partial()
  .extend({ active: z.boolean().optional() })
  .refine((patch) => Object.keys(patch).length > 0, 'Provide at least one field to change');
