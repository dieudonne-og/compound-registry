import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const SCAN = ['features', 'components/layout', 'components/common'];
// Text that is legitimately not translated: units, symbols, brand, keyboard keys, language names.
const ALLOWED = /^(kg|%|—|·|⌘K|Ctrl K|English|Français|Compound Registry|g|[A-Z]{1,3}|\d+)$/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return full.endsWith('.tsx') && !full.endsWith('.test.tsx') ? [full] : [];
  });
}

describe('screens contain no untranslated text', () => {
  const offenders: string[] = [];
  for (const file of SCAN.flatMap((d) => files(path.join(root, d)))) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/>\s*([^<>{}\n]*[A-Za-zÀ-ÿ][^<>{}\n]*?)\s*<(?=(.))/g)) {
      const text = m[1]!.trim();
      // Code between elements, not text: a ternary between JSX branches (`) : cond ? (`) or a generic call (`api<T>`).
      const ternary = text.startsWith(')') || text.endsWith('(');
      const generic = /^[a-z]\w*$/.test(text) && /[A-Z{]/.test(m[2]!);
      if (text && !ALLOWED.test(text) && !/^[=&|?:]/.test(text) && !ternary && !generic)
        offenders.push(`${path.relative(root, file)}: "${text}"`);
    }
    for (const m of src.matchAll(
      /\b(placeholder|aria-label|title|alt|description|label)="([^"]*[A-Za-z]{2}[^"]*)"/g,
    )) {
      if (!ALLOWED.test(m[2]!)) offenders.push(`${path.relative(root, file)}: ${m[1]}="${m[2]}"`);
    }
  }
  it('routes every visible string through t()', () => expect(offenders).toEqual([]));
});
