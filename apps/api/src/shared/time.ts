/** Current calendar date (YYYY-MM-DD) in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Offset of `timeZone` from UTC at the given instant, in milliseconds. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const wallClockAsUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return wallClockAsUtc - instant.getTime();
}

/** The UTC instant at which calendar day `isoDate` (YYYY-MM-DD) begins in `timeZone`. */
export function dayStartUtc(isoDate: string, timeZone: string): Date {
  const utcMidnight = new Date(`${isoDate}T00:00:00Z`);
  const firstGuess = new Date(utcMidnight.getTime() - zoneOffsetMs(utcMidnight, timeZone));
  return new Date(utcMidnight.getTime() - zoneOffsetMs(firstGuess, timeZone));
}

/** The calendar day after `isoDate`. */
export const nextDay = (isoDate: string) =>
  new Date(new Date(`${isoDate}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
