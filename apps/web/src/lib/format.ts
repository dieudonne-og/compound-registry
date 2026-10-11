const kg = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const pct = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 });
const date = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const dateTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

// Display only: values are stored and sent as decimal strings.
export const formatKg = (v: string) => `${kg.format(Number(v))} kg`;
export const formatPercent = (v: string | null) => (v === null ? '—' : `${pct.format(Number(v))} %`);
export const formatDate = (isoDate: string) => date.format(new Date(`${isoDate}T00:00:00Z`));
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const shortHash = (h: string) => `${h.slice(0, 8)}…${h.slice(-4)}`;

export function formatRelative(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of units)
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  return 'just now';
}
