const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string | number | null): string {
  let s = value === null ? '' : String(value);
  if (typeof value === 'string' && FORMULA_START.test(s)) s = `'${s}`; // Excel/Sheets would otherwise evaluate it
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with a BOM so Excel opens UTF-8 correctly. */
export function toCsv(rows: (string | number | null)[][]): string {
  return `\uFEFF${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}
