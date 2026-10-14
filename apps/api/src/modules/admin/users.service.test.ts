import { describe, expect, it } from 'vitest';
import { generateTemporaryPassword, removesLastAdmin } from './users.service';

describe('removesLastAdmin', () => {
  it('blocks demoting or disabling the only active administrator', () => {
    expect(removesLastAdmin([1], { id: 1, role: 'admin', active: true }, { role: 'operator' })).toBe(true);
    expect(removesLastAdmin([1], { id: 1, role: 'admin', active: true }, { active: false })).toBe(true);
  });
  it('counts active administrators only', () => {
    expect(removesLastAdmin([1, 2], { id: 2, role: 'admin', active: true }, { role: 'auditor' })).toBe(false);
    expect(removesLastAdmin([2], { id: 3, role: 'admin', active: false }, { role: 'operator' })).toBe(false);
  });
  it('ignores changes that keep the administrator active', () => {
    expect(removesLastAdmin([1], { id: 1, role: 'admin', active: true }, { role: 'admin' })).toBe(false);
  });
});

describe('generateTemporaryPassword', () => {
  it('uses 16 characters from an alphabet without look-alikes', () => {
    for (let i = 0; i < 20; i++) expect(generateTemporaryPassword()).toMatch(/^[A-HJ-NP-Za-hj-np-z2-9]{16}$/);
    expect(generateTemporaryPassword()).not.toBe(generateTemporaryPassword());
  });
});
