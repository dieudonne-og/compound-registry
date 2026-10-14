import { describe, expect, it } from 'vitest';
import { isTypingTarget, shortcutFor } from './shortcuts';

describe('shortcuts', () => {
  it('maps two-key sequences to destinations', () => {
    expect(shortcutFor(['g', 'p'])).toBe('/production');
    expect(shortcutFor(['g', 'u'])).toBe('/compounds/upload');
    expect(shortcutFor(['g', 'x'])).toBeNull();
    expect(shortcutFor(['p'])).toBeNull();
  });
  it('ignores keys typed into fields', () => {
    const input = document.createElement('input');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', '');
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
    expect(isTypingTarget(editable)).toBe(true);
    expect(isTypingTarget(document.body)).toBe(false);
  });
});
