import type { Catalog, Language, Leaves } from './core';
import { sharedEn } from './en';
import { sharedFr } from './fr';

export * from './core';
export { sharedEn, sharedFr };
export type SharedKey = Leaves<typeof sharedEn>;
export const SHARED_CATALOGS: Record<Language, Catalog> = {
  en: sharedEn as unknown as Catalog,
  fr: sharedFr as unknown as Catalog,
};
