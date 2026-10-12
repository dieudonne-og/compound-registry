/** The business time zone; must match the API's APP_TIMEZONE. */
export const BUSINESS_TIME_ZONE = import.meta.env.VITE_APP_TIMEZONE ?? 'Africa/Kigali';

/** Today's calendar date (YYYY-MM-DD) in the business time zone, whatever the browser's zone. */
export function businessToday(now: Date = new Date(), timeZone: string = BUSINESS_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
