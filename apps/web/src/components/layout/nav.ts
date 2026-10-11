import { Factory, FlaskConical, LayoutDashboard, PlusSquare, Upload, type LucideIcon } from 'lucide-react';
import type { Action } from '@cr/contracts';

export type NavItem = { to: string; label: string; icon: LucideIcon; action?: Action; end?: boolean };

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  { title: 'Overview', items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    title: 'Laboratory',
    items: [
      {
        to: '/compounds',
        label: 'Compound analyses',
        icon: FlaskConical,
        action: 'compound:read',
        end: true,
      },
      { to: '/compounds/upload', label: 'Upload report', icon: Upload, action: 'compound:extract' },
    ],
  },
  {
    title: 'Production',
    items: [
      { to: '/production', label: 'Production records', icon: Factory, action: 'production:read', end: true },
      { to: '/production/new', label: 'Register production', icon: PlusSquare, action: 'production:create' },
    ],
  },
];
