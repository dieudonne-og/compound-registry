import {
  Database,
  Factory,
  FlaskConical,
  LayoutDashboard,
  PlusSquare,
  ScrollText,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Action } from '@cr/contracts';

/** `title` and `label` are message keys; `tour` marks what the guided tour points at. */
export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  action?: Action;
  end?: boolean;
  tour?: string;
};

export const NAV_SECTIONS: { title: string; items: NavItem[]; tour?: string }[] = [
  {
    title: 'nav.sections.overview',
    items: [{ to: '/', label: 'nav.dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'nav.sections.laboratory',
    items: [
      { to: '/compounds', label: 'nav.compounds', icon: FlaskConical, action: 'compound:read', end: true },
      {
        to: '/compounds/upload',
        label: 'nav.upload',
        icon: Upload,
        action: 'compound:extract',
        tour: 'nav-upload',
      },
    ],
  },
  {
    title: 'nav.sections.production',
    items: [
      {
        to: '/production',
        label: 'nav.production',
        icon: Factory,
        action: 'production:read',
        end: true,
        tour: 'nav-production',
      },
      {
        to: '/production/new',
        label: 'nav.register',
        icon: PlusSquare,
        action: 'production:create',
        tour: 'nav-register',
      },
    ],
  },
  {
    title: 'nav.sections.admin',
    tour: 'nav-admin',
    items: [
      { to: '/admin/reference', label: 'nav.adminReference', icon: Database, action: 'admin:manage' },
      { to: '/admin/users', label: 'nav.adminUsers', icon: Users, action: 'admin:manage' },
      { to: '/admin/activity', label: 'nav.adminActivity', icon: ScrollText, action: 'admin:manage' },
    ],
  },
];
