import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, preferencesPatch, userPreferences } from './preferences';

describe('userPreferences', () => {
  it('fills defaults and drops unknown or invalid values', () => {
    expect(userPreferences.parse(null)).toEqual(DEFAULT_PREFERENCES);
    expect(userPreferences.parse({ theme: 'neon', pageSize: 50, extra: 1 })).toEqual({
      ...DEFAULT_PREFERENCES,
      pageSize: 50,
    });
  });
  it('rejects unknown keys and invalid values in an update', () => {
    expect(preferencesPatch.safeParse({ pageSize: 7 }).success).toBe(false);
    expect(preferencesPatch.safeParse({ colour: 'red' }).success).toBe(false);
    expect(preferencesPatch.safeParse({ language: 'fr' }).success).toBe(true);
  });
});
