import { COMPOUND_CATALOG, type CompoundDef } from '@cr/contracts';

export type CompoundMatch = { def: CompoundDef; score: number; fuzzy: boolean };

/** Lookup key: digit zero becomes letter O (OCR confusion inside formulas), case-insensitive. */
export const aliasKey = (token: string) => token.normalize('NFKC').replace(/0/g, 'O').toLowerCase();

const INDEX = new Map<string, CompoundDef>();
for (const def of COMPOUND_CATALOG) for (const alias of def.aliases) INDEX.set(aliasKey(alias), def);
const FUZZY_KEYS = [...INDEX.keys()].filter((k) => k.length >= 4);

const digits = (s: string) => s.replace(/\D/g, '');

function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function matchCompound(token: string): CompoundMatch | null {
  const key = aliasKey(token);
  const def = INDEX.get(key);
  if (def) {
    // Element symbols are case-sensitive: "As" is arsenic, "as" is an English word.
    if (def.kind === 'element' && !def.aliases.includes(token)) return null;
    const repaired = key !== token.normalize('NFKC').toLowerCase();
    return { def, score: repaired ? 0.95 : 1, fuzzy: false };
  }
  if (key.length < 4) return null;
  const near = FUZZY_KEYS.find((k) => digits(k) === digits(key) && withinOneEdit(k, key));
  return near ? { def: INDEX.get(near)!, score: 0.75, fuzzy: true } : null;
}
