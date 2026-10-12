import { useEffect } from 'react';
import { useMatches } from 'react-router';
import { useT } from '@/i18n/i18n';
import { Suspense, useState } from 'react';
import { Outlet } from 'react-router';
import { FlaskConical } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PageLoader } from '@/components/common/page-loader';
import { CommandMenu } from './command-menu';
import { Sidebar, SidebarNav } from './sidebar';
import { Topbar } from './topbar';

const readCollapsed = () => {
  try {
    return localStorage.getItem('sidebar-collapsed') === '1';
  } catch {
    return false;
  }
};

export function AppShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const t = useT();
  const crumb = useMatches()
    .map((m) => (m.handle as { crumb?: string } | undefined)?.crumb)
    .filter(Boolean)
    .at(-1);
  useEffect(() => {
    document.title = crumb ? `${t(crumb)} · Compound Registry` : 'Compound Registry';
  }, [crumb, t]);

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem('sidebar-collapsed', c ? '0' : '1');
      } catch {
        /* preference not persisted */
      }
      return !c;
    });

  return (
    <div className="flex min-h-dvh" style={{ ['--sidebar-width' as string]: collapsed ? '4rem' : '16rem' }}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:shadow"
      >
        {t('common.skipToContent')}
      </a>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-4">
          <SheetHeader className="px-1">
            <SheetTitle className="flex items-center gap-2">
              <FlaskConical className="size-5 text-primary" /> Compound Registry
            </SheetTitle>
          </SheetHeader>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} onSearch={() => setSearchOpen(true)} />
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
