import { describe, expect, it } from 'vitest';
import { can, type Role } from '@cr/contracts';
import { buildTour } from './tour';

const allowFor = (role: Role) => (a: Parameters<typeof can>[1]) => can({ id: 1, role }, a);
const ids = (role: Role, visible: (t: string) => boolean = () => true) =>
  buildTour(allowFor(role), visible).map((s) => s.id);

describe('buildTour', () => {
  it('starts with the common steps and ends with how to replay it', () => {
    const steps = ids('auditor');
    expect(steps[0]).toBe('welcome');
    expect(steps.at(-1)).toBe('replay');
  });
  it('tailors steps to the role', () => {
    expect(ids('operator')).toEqual(expect.arrayContaining(['upload', 'register']));
    expect(ids('operator')).not.toContain('admin');
    expect(ids('auditor')).toContain('audit');
    expect(ids('auditor')).not.toContain('upload');
    expect(ids('admin')).toContain('admin');
  });
  it('drops steps whose target is not on screen (e.g. sidebar on a phone)', () => {
    expect(ids('admin', (t) => !t.startsWith('nav'))).not.toContain('register');
    expect(ids('admin', (t) => !t.startsWith('nav'))[0]).toBe('welcome');
  });
});
