import { z } from 'zod';
import { ROLES } from './auth';
import { pageQuery } from './pagination';

export const userAdminView = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  role: z.enum(ROLES),
  active: z.boolean(),
  mustChangePassword: z.boolean(),
  lastSignInAt: z.string().nullable(),
  createdAt: z.string(),
});
export type UserAdminView = z.infer<typeof userAdminView>;

const name = z.string().trim().min(2, 'validation.name').max(120);
const email = z.string().trim().toLowerCase().email('validation.email').max(190);

export const createUserInput = z.object({ name, email, role: z.enum(ROLES) });
export type CreateUserInput = z.infer<typeof createUserInput>;

export const updateUserInput = z
  .object({ name: name.optional(), role: z.enum(ROLES).optional(), active: z.boolean().optional() })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'validation.reference.nothingToChange');
export type UpdateUserInput = z.infer<typeof updateUserInput>;

/** The temporary password is returned once, to the administrator who created or reset it, and never stored in clear. */
export const temporaryPasswordResponse = z.object({ user: userAdminView, temporaryPassword: z.string() });
export type TemporaryPasswordResponse = z.infer<typeof temporaryPasswordResponse>;

export const ACTIVITY_ACTIONS = [
  'user.created',
  'user.updated',
  'user.disabled',
  'user.enabled',
  'user.password_reset',
  'reference.created',
  'reference.updated',
  'reference.retired',
  'reference.reactivated',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];
export const ACTIVITY_TARGETS = ['user', 'reference'] as const;
export type ActivityTarget = (typeof ACTIVITY_TARGETS)[number];

export const activityEntry = z.object({
  id: z.number().int(),
  actor: z.object({ id: z.number().int(), label: z.string() }),
  action: z.enum(ACTIVITY_ACTIONS),
  targetType: z.enum(ACTIVITY_TARGETS),
  targetId: z.number().int(),
  targetLabel: z.string(),
  before: z.record(z.unknown()).nullable(),
  after: z.record(z.unknown()).nullable(),
  occurredAt: z.string(),
});
export type ActivityEntry = z.infer<typeof activityEntry>;

export const activityQuery = pageQuery.extend({
  action: z.enum(ACTIVITY_ACTIONS).optional(),
  targetType: z.enum(ACTIVITY_TARGETS).optional(),
});
export type ActivityQuery = z.infer<typeof activityQuery>;
