import { z } from 'zod';

/** Half-up rounding on decimal strings; never goes through floating point. */
export function roundDecimal(value: string, scale: number): string {
  const [int = '0', frac = ''] = value.trim().split('.');
  if (frac.length <= scale) return `${BigInt(int)}.${frac.padEnd(scale, '0')}`;
  const rounded = BigInt(int + frac.slice(0, scale)) + (Number(frac[scale]) >= 5 ? 1n : 0n);
  const digits = rounded.toString().padStart(scale + 1, '0');
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}

export const percentValue = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,4})?$/, 'validation.percent.format')
  .refine((v) => Number(v) <= 100, 'validation.percent.range');

export const weightKgValue = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,3})?$/, 'validation.weight.format')
  .refine((v) => /[1-9]/.test(v), 'validation.weight.positive');
