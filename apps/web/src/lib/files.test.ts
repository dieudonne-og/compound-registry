import { describe, expect, it } from 'vitest';
import { validateReportFile } from './files';

const file = (name: string, size: number, type = '') => new File([new Uint8Array(size)], name, { type });

describe('validateReportFile', () => {
  it('accepts the supported formats', () => {
    for (const n of ['a.pdf', 'b.JPG', 'c.jpeg', 'd.png'])
      expect(validateReportFile(file(n, 10), 10)).toBeNull();
  });
  it('explains unsupported types', () => {
    expect(validateReportFile(file('a.docx', 10), 10)).toMatch(/PDF, JPG, JPEG or PNG/);
  });
  it('explains oversize files with the actual size', () => {
    expect(validateReportFile(file('a.pdf', 11 * 1024 * 1024), 10)).toBe(
      'This file is 11.0 MB. The maximum is 10 MB.',
    );
  });
  it('rejects empty files', () => expect(validateReportFile(file('a.pdf', 0), 10)).toMatch(/empty/));
});
