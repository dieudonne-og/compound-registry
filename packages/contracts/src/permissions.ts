import type { Role } from './auth';

export const ACTIONS = [
  'compound:extract',
  'compound:create',
  'compound:read',
  'compound:file',
  'production:create',
  'production:read',
  'production:update',
  'production:update-critical',
  'production:update-code',
  'audit:read',
  'audit:verify',
  'reference:manage',
  'admin:manage',
] as const;
export type Action = (typeof ACTIONS)[number];

const ALL: readonly Role[] = ['admin', 'supervisor', 'operator', 'auditor'];
const WRITERS: readonly Role[] = ['admin', 'supervisor', 'operator'];

const MATRIX: Record<Action, readonly Role[]> = {
  'compound:extract': WRITERS,
  'compound:create': WRITERS,
  'compound:read': ALL,
  'compound:file': ALL,
  'production:create': WRITERS,
  'production:read': ALL,
  'production:update': WRITERS,
  'production:update-critical': ['admin', 'supervisor'],
  'production:update-code': ['admin'],
  'audit:read': ['admin', 'supervisor', 'auditor'],
  'audit:verify': ['admin', 'supervisor', 'auditor'],
  'reference:manage': ['admin'],
  'admin:manage': ['admin'],
};

/**
 * Single source of truth for authorization, used by the API guard and to hide UI controls.
 * For operators, `production:update` is limited to records they created when a resource is given.
 */
export function can(
  user: { id: number; role: Role } | null | undefined,
  action: Action,
  resource?: { createdBy: number },
): boolean {
  if (!user || !MATRIX[action].includes(user.role)) return false;
  if (action === 'production:update' && user.role === 'operator' && resource) {
    return resource.createdBy === user.id;
  }
  return true;
}
