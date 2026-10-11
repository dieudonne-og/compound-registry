import { describe, expect, it } from 'vitest';
import { todayIn } from './time';

describe('todayIn', () => {
  it('uses the business time zone, not UTC', () => {
    const lateEveningKigali = new Date('2026-10-10T22:30:00Z'); // 00:30 on 11 Oct in Kigali
    expect(todayIn('Africa/Kigali', lateEveningKigali)).toBe('2026-10-11');
    expect(todayIn('UTC', lateEveningKigali)).toBe('2026-10-10');
  });
});
