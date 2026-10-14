import type { ExtractionWarning, Params } from '@cr/contracts';

/** Warning text in the interface language; warnings saved before params existed keep their stored English text. */
export function warningText(
  w: ExtractionWarning,
  t: (key: string, params?: Params) => string,
  date: (isoDate: string) => string,
): string {
  if (w.code === 'LOW_OVERALL_CONFIDENCE') return t('compounds.warnings.LOW_OVERALL_CONFIDENCE');
  if (!w.params) return w.message;
  const params = w.code === 'DUPLICATE_FILE' ? { ...w.params, date: date(String(w.params.date)) } : w.params;
  return t(`compounds.warnings.${w.code}`, params);
}
