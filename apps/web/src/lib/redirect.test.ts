import { describe, expect, it } from 'vitest';
import { safeNext } from './redirect';

describe('safeNext', () => {
  it('keeps in-app paths', () => {
    expect(safeNext('/production/4?tab=history')).toBe('/production/4?tab=history');
  });
  it('rejects other sites, protocol-relative and backslash tricks', () => {
    for (const bad of [
      '//evil.example',
      '/\\evil.example',
      'https://evil.example',
      'javascript:alert(1)',
      '',
      null,
    ]) {
      expect(safeNext(bad)).toBe('/');
    }
  });
});
