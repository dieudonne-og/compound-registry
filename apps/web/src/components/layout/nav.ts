import { Factory, FlaskConical, LayoutDashboard, PlusSquare, Upload, type LucideIcon } from 'lucide-react';
import type { Action } from '@cr/contracts';

/** `title` and `label` are message keys, translated where they are shown. */
export type NavItem = { to: string; label: string; icon: LucideIcon; action?: Action; end?: boolean };

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'nav.sections.overview',
    items: [{ to: '/', label: 'nav.dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'nav.sections.laboratory',
    items: [
      { to: '/compounds', label: 'nav.compounds', icon: FlaskConical, action: 'compound:read', end: true },
      { to: '/compounds/upload', label: 'nav.upload', icon: Upload, action: 'compound:extract' },
    ],
  },
  {
    title: 'nav.sections.production',
    items: [
      { to: '/production', label: 'nav.production', icon: Factory, action: 'production:read', end: true },
      { to: '/production/new', label: 'nav.register', icon: PlusSquare, action: 'production:create' },
    ],
  },
];
