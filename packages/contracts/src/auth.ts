import { z } from 'zod';
import { userPreferences } from './preferences';

export const ROLES = ['admin', 'supervisor', 'operator', 'auditor'] as const;
export type Role = (typeof ROLES)[number];

export const loginInput = z.object({
  email: z.string().trim().toLowerCase().email('validation.email'),
  password: z.string().min(1, 'validation.passwordRequired').max(200),
});
export type LoginInput = z.infer<typeof loginInput>;

export const sessionUser = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  role: z.enum(ROLES),
});
export type SessionUser = z.infer<typeof sessionUser>;

export const changePasswordInput = z.object({
  currentPassword: z.string().min(1, 'validation.passwordRequired').max(200),
  newPassword: z.string().min(12, 'validation.passwordMin').max(200),
});
export type ChangePasswordInput = z.infer<typeof changePasswordInput>;

/** `GET /api/auth/me`: the session plus what the interface needs before showing any screen. */
export const meResponse = z.object({
  user: sessionUser,
  mustChangePassword: z.boolean(),
  preferences: userPreferences,
});
export type MeResponse = z.infer<typeof meResponse>;
