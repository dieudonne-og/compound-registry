import { describe, expect, it } from 'vitest';
import { businessToday } from './business-day';

describe('businessToday', () => {
  it('uses the business time zone, not the browser’s', () => {
    const lateEveningUtc = new Date('2026-10-10T22:30:00Z'); // already 11 October in Kigali
    expect(businessToday(lateEveningUtc, 'Africa/Kigali')).toBe('2026-10-11');
    expect(businessToday(lateEveningUtc, 'America/New_York')).toBe('2026-10-10');
  });
});
