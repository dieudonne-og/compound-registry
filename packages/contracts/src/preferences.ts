import { z } from 'zod';
import { LANGUAGES } from './i18n';

/** Raise when the guided tour changes enough that everyone should see it again. */
export const TOUR_VERSION = 1;

const THEMES = ['light', 'dark', 'system'] as const;
const DENSITIES = ['comfortable', 'compact'] as const;
const DATE_STYLES = ['local', 'iso'] as const;
const pageSize = z.union([z.literal(10), z.literal(20), z.literal(50)]);
const tour = z.object({ version: z.number().int(), completedAt: z.string().nullable() });

const shape = z.object({
  language: z.enum(LANGUAGES).nullable().catch(null),
  theme: z.enum(THEMES).catch('system'),
  density: z.enum(DENSITIES).catch('comfortable'),
  pageSize: pageSize.catch(20),
  dateStyle: z.enum(DATE_STYLES).catch('local'),
  tour: tour.nullable().catch(null),
});

export type UserPreferences = z.infer<typeof shape>;
/** Stored JSON → complete preferences: unknown keys dropped, invalid values replaced by defaults. */
export const userPreferences = z.preprocess((v) => (v && typeof v === 'object' ? v : {}), shape);
export const DEFAULT_PREFERENCES: UserPreferences = shape.parse({});

/** Partial update; unknown keys and invalid values are rejected (422) rather than silently fixed. */
export const preferencesPatch = z
  .object({
    language: z.enum(LANGUAGES),
    theme: z.enum(THEMES),
    density: z.enum(DENSITIES),
    pageSize,
    dateStyle: z.enum(DATE_STYLES),
    tour,
  })
  .partial()
  .strict();
export type PreferencesPatch = z.infer<typeof preferencesPatch>;
