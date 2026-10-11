import { describe, expect, it } from 'vitest';
import { normalizeLine } from './normalize';

describe('normalizeLine', () => {
  it('turns subscripts into digits', () => expect(normalizeLine('Nb₂O₅  0.70')).toBe('Nb2O5 0.70'));
  it('turns decimal commas into dots', () =>
    expect(normalizeLine('Moisture = 0,067')).toBe('Moisture = 0.067'));
  it('unifies dash characters', () => expect(normalizeLine('W — ')).toBe('W -'));
  it('maps full-width symbols', () => expect(normalizeLine('Sn＝63.63')).toBe('Sn=63.63'));
});
