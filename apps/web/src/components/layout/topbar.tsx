import { Fragment } from 'react';
import { Link, useMatches } from 'react-router';
import { Menu, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useT } from '@/i18n/i18n';
import { LanguageSwitch } from './language-switch';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

type Crumb = { crumb?: string };

export function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const t = useT();
  const crumbs = useMatches()
    .filter((m) => (m.handle as Crumb | undefined)?.crumb)
    .map((m) => ({ to: m.pathname, label: t((m.handle as Crumb).crumb!) }));
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenu}
        aria-label={t('layout.openNavigation')}
      >
        <Menu />
      </Button>
      <Breadcrumb className="hidden min-w-0 sm:block">
        <BreadcrumbList>
          {crumbs.map((c, i) => (
            <Fragment key={c.to}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {i === crumbs.length - 1 ? (
                  <BreadcrumbPage>{c.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={c.to}>{c.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="outline"
          onClick={onSearch}
          className="h-9 gap-2 text-muted-foreground sm:w-64 sm:justify-start"
          aria-label={t('layout.search')}
          data-tour="search"
        >
          <Search className="size-4" />
          <span className="hidden sm:inline">{t('layout.searchPlaceholder')}</span>
          <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">
            ⌘K
          </kbd>
        </Button>
        <LanguageSwitch />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
