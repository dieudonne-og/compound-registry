import { describe, expect, it } from 'vitest';
import { parseLines, type TextLine } from './parser';

const lines = (text: string, confidence = 1): TextLine[] =>
  text.split('\n').map((t) => ({ text: t, confidence }));
const valueOf = (r: ReturnType<typeof parseLines>, column: string) =>
  r.fields.find((f) => f.column === column);

describe('parseLines — sample layouts', () => {
  it('reads an "X = value" certificate with OCR zero/O mix-ups and decimal commas', () => {
    const r = parseLines(
      lines(`Customer: RAW MINERALS RESOURCES Sarl (RMR)
Address: N 4 KK 621 GIKONDO
Your sample No: Lot: RMR/TSR/SN/0000045 ASIR S31706
Test method used: Assay by XRF SOP/002 and WET-CHEM/002
Chemical Analysis in %:
Sn = 63.63
Moisture = 0,067
Si02 = 11.32
Na20 = 0.01
U308 = 0.016
Report Date: 20.05.2025`),
    );
    expect(valueOf(r, 'sn_percent')?.value).toBe('63.6300');
    expect(valueOf(r, 'moisture_percent')?.value).toBe('0.0670');
    expect(valueOf(r, 'sio2_percent')).toMatchObject({ value: '11.3200', confidence: 0.95, flags: [] });
    expect(valueOf(r, 'na2o_percent')?.value).toBe('0.0100');
    expect(valueOf(r, 'u3o8_percent')?.value).toBe('0.0160');
    expect(r.fields).toHaveLength(5);
    expect(r.unmapped).toEqual([]);
  });

  it('reads a French table, ignores the sample weight and keeps "/" as NULL', () => {
    const r = parseLines(
      lines(`MINEXX S.A.R.L / LUMA (EX STANBUD S.A.R.L.U
CERTIFICAT D’ANALYSES
N° D’ÉCHANTILLON POIDS (Kg) ELEMENTS TENEUR (%)
Man_Sn 013 T 320.3 Ta 0.83
Nb₂O₅ 0.70
Sn 58.72
W /
Fe 1.14
Mn 0.11`),
    );
    expect(Object.fromEntries(r.fields.map((f) => [f.column, f.value]))).toEqual({
      sn_percent: '58.7200',
      nb2o5_percent: '0.7000',
      fe_percent: '1.1400',
      mn_percent: '0.1100',
      wo_percent: null,
      ta_percent: '0.8300',
    });
    expect(valueOf(r, 'wo_percent')?.flags).toContain('missing_marker');
  });

  it('reads an XRF screen: second number is uncertainty, element-only symbols stay unmapped', () => {
    const r = parseLines(
      lines(
        `# 690 Mining Ta/Hf
Time 182.6 sec
Ele | % | ±2σ
Nb 18.04 0.81
Nb205 25.79
Ta205 27.43
Mn 6.07 0.22
Zn 0.067 0.020
As 0.270 0.027
Se 0.112 0.013
Y 0.053 0.003
Zr 0.399 0.021`,
        0.9,
      ),
    );
    expect(valueOf(r, 'mn_percent')).toMatchObject({ value: '6.0700', uncertainty: '0.22' });
    expect(valueOf(r, 'zn_percent')?.value).toBe('0.0670');
    expect(valueOf(r, 'zno_percent')).toBeUndefined();
    expect(valueOf(r, 'as_percent')?.value).toBe('0.2700');
    expect(valueOf(r, 'nb2o5_percent')?.value).toBe('25.7900');
    expect(valueOf(r, 'ta2o5_percent')?.value).toBe('27.4300');
    expect(r.unmapped.map((u) => u.label)).toEqual(['Nb', 'Se', 'Y', 'Zr']);
    expect(r.unmapped.every((u) => u.reason === 'no_column')).toBe(true);
  });
});

describe('parseLines — rules', () => {
  it('flags integers as implausible so seal numbers are never trusted (e.g. "Cu 29")', () => {
    const r = parseLines(lines('Co Ni Cu 29\nPt 78 Au'));
    const cu = valueOf(r, 'cu_percent');
    expect(cu?.flags).toContain('low_confidence');
    expect(cu!.confidence).toBeLessThan(0.85);
    expect(r.unmapped).toEqual([]); // integers are never reported as unmapped element values
  });

  it('reads French labels with accents', () => {
    expect(valueOf(parseLines(lines('Humidité 0,52')), 'moisture_percent')?.value).toBe('0.5200');
  });

  it('flags values equal to the element’s atomic mass, as printed on seals and periodic-table stamps', () => {
    expect(valueOf(parseLines(lines('Cu 63.546')), 'cu_percent')?.flags).toContain('low_confidence');
    expect(valueOf(parseLines(lines('Fe 55.85')), 'fe_percent')?.flags).toContain('low_confidence');
    expect(valueOf(parseLines(lines('Cu 12.75')), 'cu_percent')?.flags).toEqual([]);
  });

  it('marks conflicting duplicates and keeps both candidates', () => {
    const r = parseLines(lines('Sn = 63.63\nSn = 36.63'));
    expect(valueOf(r, 'sn_percent')).toMatchObject({
      flags: ['conflict'],
      candidates: ['63.6300', '36.6300'],
    });
  });

  it('merges identical duplicates silently', () => {
    expect(valueOf(parseLines(lines('Sn = 63.63\nSn = 63.63')), 'sn_percent')?.flags).toEqual([]);
  });

  it('rounds values with more than 4 decimals and says so', () => {
    expect(valueOf(parseLines(lines('Fe 1.123456')), 'fe_percent')).toMatchObject({
      value: '1.1235',
      flags: ['precision_truncated'],
    });
  });

  it('flags values above 100 %', () => {
    expect(valueOf(parseLines(lines('Sn = 163.63')), 'sn_percent')?.flags).toEqual([
      'out_of_range',
      'low_confidence',
    ]);
  });

  it('treats below-detection results as missing, not zero', () => {
    expect(valueOf(parseLines(lines('Cu <0.01')), 'cu_percent')).toMatchObject({
      value: null,
      flags: ['missing_marker'],
    });
  });

  it('accepts dashes as separators when a number follows', () => {
    expect(valueOf(parseLines(lines('Sn - 63.63')), 'sn_percent')?.value).toBe('63.6300');
  });

  it('ignores weights, dates, phone numbers and words that look like symbols', () => {
    const r = parseLines(
      lines('Net: 6,470Kgs\nTel: +250788307840\nDate of receipt: 19.05.2025\nNature of sample: As received'),
    );
    expect(r.fields).toEqual([]);
    expect(r.unmapped).toEqual([]);
  });

  it('routes manual-only columns to the unmapped list', () => {
    expect(parseLines(lines('Balance 12.5')).unmapped).toEqual([
      { label: 'Balance', value: '12.5', rawText: 'Balance 12.5', reason: 'manual_only' },
    ]);
  });

  it('flags fuzzy names and low OCR confidence', () => {
    const r = parseLines([
      { text: 'Moistur = 0.07', confidence: 0.98 },
      { text: 'Fe 1.10', confidence: 0.6 },
    ]);
    expect(valueOf(r, 'moisture_percent')?.flags).toEqual(['fuzzy_name', 'low_confidence']);
    expect(valueOf(r, 'fe_percent')?.flags).toEqual(['low_confidence']);
  });

  it('warns when the mapped total exceeds 105 %', () => {
    expect(parseLines(lines('Sn = 70.1\nSiO2 = 40.2')).warnings.map((w) => w.code)).toContain(
      'TOTAL_EXCEEDS_100',
    );
  });

  it('returns fields in catalog order with an overall confidence', () => {
    const r = parseLines(lines('Ni 0.5\nSn 60.1'));
    expect(r.fields.map((f) => f.column)).toEqual(['sn_percent', 'ni_percent']);
    expect(r.overallConfidence).toBe(1);
  });
});
