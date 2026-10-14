import type { Action } from '@cr/contracts';

export type TourStep = { id: string; target: string | null };

/** Texts are `tour.<id>.title` / `.body`; `target` is a `data-tour` value (null: a centred popover). */
const STEPS: { id: string; target: string | null; when?: (allow: (a: Action) => boolean) => boolean }[] = [
  { id: 'welcome', target: null },
  { id: 'nav', target: 'nav' },
  { id: 'search', target: 'search' },
  { id: 'upload', target: 'nav-upload', when: (a) => a('compound:extract') },
  { id: 'register', target: 'nav-register', when: (a) => a('production:create') },
  { id: 'history', target: 'nav-production', when: (a) => a('production:create') },
  { id: 'audit', target: 'nav-production', when: (a) => a('audit:verify') && !a('production:create') },
  { id: 'admin', target: 'nav-admin', when: (a) => a('admin:manage') },
  { id: 'language', target: 'language' },
  { id: 'theme', target: 'theme' },
  { id: 'replay', target: 'help' },
];

/** The steps for this user: their role decides which apply, and steps pointing at hidden elements are skipped. */
export function buildTour(allow: (a: Action) => boolean, isVisible: (target: string) => boolean): TourStep[] {
  return STEPS.filter(
    (s) => (s.when ? s.when(allow) : true) && (s.target === null || isVisible(s.target)),
  ).map(({ id, target }) => ({ id, target }));
}
