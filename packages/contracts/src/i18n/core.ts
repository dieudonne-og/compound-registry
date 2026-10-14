export const LANGUAGES = ['en', 'fr'] as const;
export type Language = (typeof LANGUAGES)[number];
export const LOCALES: Record<Language, string> = { en: 'en-GB', fr: 'fr-FR' };

export type Plural = { one: string; other: string };
export type Catalog = { [key: string]: string | Plural | Catalog };
export type Params = Record<string, string | number>;

/** Same keys as T; every leaf a string (or plural). Used to type translations against English. */
export type Shape<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends Plural ? Plural : Shape<T[K]>;
};

/** Dotted paths to every leaf of a catalogue, e.g. 'errors.NOT_FOUND'. */
export type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string | Plural ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

const isPlural = (v: unknown): v is Plural => typeof v === 'object' && v !== null && 'other' in v;

function lookup(catalog: Catalog | undefined, key: string): string | Plural | undefined {
  let node: unknown = catalog;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Catalog)[part];
  }
  return typeof node === 'string' || isPlural(node) ? node : undefined;
}

/** Translates `key`; falls back to English, then to the key itself (so plain sentences pass through). */
export function translate(
  catalogs: Record<Language, Catalog>,
  language: Language,
  key: string,
  params: Params = {},
): string {
  const entry = lookup(catalogs[language], key) ?? lookup(catalogs.en, key);
  if (entry === undefined) return key;
  const text =
    typeof entry === 'string'
      ? entry
      : entry[
          new Intl.PluralRules(LOCALES[language]).select(Number(params.count ?? 0)) === 'one'
            ? 'one'
            : 'other'
        ];
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Best supported language for an Accept-Language header; English when none matches. */
export function pickLanguage(header: string | null | undefined): Language {
  const ranked = (header ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', q] = part.trim().split(';q=');
      return { lang: tag.slice(0, 2).toLowerCase(), q: q === undefined ? 1 : Number(q) };
    })
    .filter((r) => r.lang)
    .sort((a, b) => b.q - a.q);
  return (ranked.find((r) => (LANGUAGES as readonly string[]).includes(r.lang))?.lang as Language) ?? 'en';
}
