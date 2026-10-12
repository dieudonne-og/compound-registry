import { describe, expect, it } from 'vitest';
import { can } from './permissions';

const user = (role: 'admin' | 'supervisor' | 'operator' | 'auditor', id = 1) => ({ id, role });

describe('can', () => {
  it('denies anonymous users', () => expect(can(null, 'production:read')).toBe(false));
  it('lets auditors read and verify but not write', () => {
    expect(can(user('auditor'), 'audit:verify')).toBe(true);
    expect(can(user('auditor'), 'production:create')).toBe(false);
    expect(can(user('auditor'), 'compound:extract')).toBe(false);
  });
  it('limits operators to their own records for non-critical edits', () => {
    expect(can(user('operator', 7), 'production:update', { createdBy: 7 })).toBe(true);
    expect(can(user('operator', 7), 'production:update', { createdBy: 8 })).toBe(false);
    expect(can(user('operator'), 'production:update-critical')).toBe(false);
  });
  it('reserves production code changes and reference management for admins', () => {
    expect(can(user('supervisor'), 'production:update-code')).toBe(false);
    expect(can(user('admin'), 'production:update-code')).toBe(true);
    expect(can(user('supervisor'), 'reference:manage')).toBe(false);
  });
});
