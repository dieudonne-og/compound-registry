import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LOCALES, SHARED_CATALOGS, translate, type Catalog, type Language, type Params } from '@cr/contracts';
import { setRequestLanguage } from '@/lib/api';
import {
  formatDate,
  formatDateTime,
  formatKg,
  formatPercent,
  formatRelative,
  type DateStyle,
} from '@/lib/format';
import { webEn } from './en';
import { webFr } from './fr';

const CATALOGS: Record<Language, Catalog> = {
  en: { ...SHARED_CATALOGS.en, ...(webEn as unknown as Catalog) },
  fr: { ...SHARED_CATALOGS.fr, ...(webFr as unknown as Catalog) },
};

/** Translates outside React (e.g. in module-level helpers); components use `useI18n().t`. */
export const translateIn = (language: Language, key: string, params?: Params) =>
  translate(CATALOGS, language, key, params);

type I18nContextValue = {
  language: Language;
  locale: string;
  dateStyle: DateStyle;
  setDateStyle: (style: DateStyle) => void;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Params) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export const browserLanguage = (): Language =>
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';

const STORAGE_KEY = 'language';
/** The last language chosen in this browser (also used before signing in); storage may be unavailable. */
const storedLanguage = (): Language | null => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'en' || v === 'fr' ? v : null;
  } catch {
    return null;
  }
};

export function I18nProvider({ initial, children }: { initial?: Language; children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(
    () => initial ?? storedLanguage() ?? browserLanguage(),
  );
  // Set synchronously too, so requests made during the first render already carry the language.
  setRequestLanguage(language);
  const [dateStyle, setDateStyle] = useState<DateStyle>('local');
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* not remembered in this browser */
    }
  }, []);
  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      locale: LOCALES[language],
      dateStyle,
      setDateStyle,
      setLanguage,
      t: (key, params) => translate(CATALOGS, language, key, params),
    }),
    [language, setLanguage, dateStyle],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

export const useT = () => useI18n().t;

/** Formatters bound to the active locale and the user's date style. */
export function useFormat() {
  const { locale, dateStyle } = useI18n();
  return useMemo(
    () => ({
      kg: (v: string) => formatKg(v, locale),
      percent: (v: string | null) => formatPercent(v, locale),
      date: (iso: string) => formatDate(iso, locale, dateStyle),
      dateTime: (iso: string) => formatDateTime(iso, locale),
      relative: (iso: string) => formatRelative(iso, locale),
    }),
    [locale, dateStyle],
  );
}
