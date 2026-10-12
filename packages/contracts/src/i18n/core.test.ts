import { describe, expect, it } from 'vitest';
import { pickLanguage, translate, type Catalog, type Language } from './core';
import { SHARED_CATALOGS } from './index';

const catalogs: Record<Language, Catalog> = {
  en: {
    greet: 'Hello {name}',
    items: { one: '{count} value', other: '{count} values' },
    onlyEn: 'English only',
  },
  fr: { greet: 'Bonjour {name}', items: { one: '{count} valeur', other: '{count} valeurs' } },
};

describe('translate', () => {
  it('fills placeholders', () =>
    expect(translate(catalogs, 'fr', 'greet', { name: 'Eric' })).toBe('Bonjour Eric'));
  it('uses each language’s plural rules, including zero', () => {
    expect(translate(catalogs, 'en', 'items', { count: 0 })).toBe('0 values');
    expect(translate(catalogs, 'fr', 'items', { count: 0 })).toBe('0 valeur');
    expect(translate(catalogs, 'fr', 'items', { count: 3 })).toBe('3 valeurs');
  });
  it('falls back to English, then to the key itself', () => {
    expect(translate(catalogs, 'fr', 'onlyEn')).toBe('English only');
    expect(translate(catalogs, 'fr', 'A dynamic sentence.')).toBe('A dynamic sentence.');
  });
});

describe('pickLanguage', () => {
  it.each([
    ['fr-CA,fr;q=0.9,en;q=0.8', 'fr'],
    ['en-GB,fr;q=0.5', 'en'],
    ['de-DE,de;q=0.9', 'en'],
    ['de-DE,fr;q=0.7', 'fr'],
    ['', 'en'],
    [null, 'en'],
  ])('%s → %s', (header, lang) => expect(pickLanguage(header)).toBe(lang));
});

describe('shared catalogues', () => {
  it('have a French message for every error code', async () => {
    const { ERROR_CODES } = await import('../errors');
    for (const code of ERROR_CODES)
      expect(translate(SHARED_CATALOGS, 'fr', `errors.${code}`)).not.toBe(`errors.${code}`);
  });
});
