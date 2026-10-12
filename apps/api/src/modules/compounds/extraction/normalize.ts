/** Cleans one line of extracted text without changing its meaning. */
export function normalizeLine(text: string): string {
  return text
    .normalize('NFKC') // subscripts → digits, full-width → ASCII
    .replace(/[‐-―−]/g, '-')
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[ \t\u00A0]+/g, ' ')
    .trim();
}
