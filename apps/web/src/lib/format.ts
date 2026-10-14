export type DateStyle = 'local' | 'iso';

// Display only: values are stored and sent as decimal strings. Formatters are created per call;
// that is cheap at this scale and keeps them correct when the language changes.
export const formatKg = (v: string, locale = 'en-GB') =>
  `${new Intl.NumberFormat(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(v))} kg`;

export const formatPercent = (v: string | null, locale = 'en-GB') =>
  v === null ? '—' : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(Number(v))} %`;

/** Calendar dates (YYYY-MM-DD) are shown in UTC so they never shift by a day. */
export const formatDate = (isoDate: string, locale = 'en-GB', style: DateStyle = 'local') =>
  style === 'iso'
    ? isoDate
    : new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${isoDate}T00:00:00Z`));

export const formatDateTime = (iso: string, locale = 'en-GB') =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

export const shortHash = (h: string) => `${h.slice(0, 8)}…${h.slice(-4)}`;

export function formatRelative(iso: string, locale = 'en-GB'): string {
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of units)
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  return relative.format(0, 'second');
}
