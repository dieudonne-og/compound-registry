import { z } from 'zod';

export const ROLES = ['admin', 'supervisor', 'operator', 'auditor'] as const;
export type Role = (typeof ROLES)[number];

export const loginInput = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password').max(200),
});
export type LoginInput = z.infer<typeof loginInput>;

export const sessionUser = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  role: z.enum(ROLES),
});
export type SessionUser = z.infer<typeof sessionUser>;
