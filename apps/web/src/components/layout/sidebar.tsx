import { NavLink } from 'react-router';
import { FlaskConical, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCan } from '@/features/auth/session';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useT } from '@/i18n/i18n';
import { NAV_SECTIONS } from './nav';

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const can = useCan();
  const t = useT();
  return (
    <nav aria-label={t('nav.main')} className="flex flex-col gap-6">
      {NAV_SECTIONS.map((section) => {
        const items = section.items.filter((i) => !i.action || can(i.action));
        if (!items.length) return null;
        return (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <p className="px-3 text-xs font-medium text-muted-foreground">{t(section.title)}</p>
            )}
            {items.map(({ to, label, icon: Icon, end }) => {
              const link = (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60 focus-visible:outline-2 focus-visible:outline-ring',
                      isActive && 'bg-sidebar-accent text-accent-foreground',
                      collapsed && 'justify-center px-0',
                    )
                  }
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className={cn(collapsed && 'sr-only')}>{t(label)}</span>
                </NavLink>
              );
              return collapsed ? (
                <Tooltip key={to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{t(label)}</TooltipContent>
                </Tooltip>
              ) : (
                link
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const t = useT();
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 lg:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex h-14 items-center gap-2.5 border-b px-4 font-semibold tracking-tight',
          collapsed && 'justify-center px-0',
        )}
      >
        <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
          <FlaskConical className="size-4" />
        </span>
        {!collapsed && 'Compound Registry'}
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <SidebarNav collapsed={collapsed} />
      </div>
      <button
        onClick={onToggle}
        className="m-3 flex h-9 items-center justify-center gap-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
        aria-label={collapsed ? t('layout.expandSidebar') : t('layout.collapseSidebar')}
      >
        {collapsed ? (
          <PanelLeftOpen className="size-4" />
        ) : (
          <>
            <PanelLeftClose className="size-4" /> {t('layout.collapse')}
          </>
        )}
      </button>
    </aside>
  );
}
