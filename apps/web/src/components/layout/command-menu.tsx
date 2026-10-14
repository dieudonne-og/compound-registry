import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Factory } from 'lucide-react';
import type { Page, ProductionRecord } from '@cr/contracts';
import { api } from '@/lib/api';
import { useDebouncedValue } from '@/lib/use-debounced';
import { useCan } from '@/features/auth/session';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useT } from '@/i18n/i18n';
import { NAV_SECTIONS } from './nav';

export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const can = useCan();
  const t = useT();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 250);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const records = useQuery({
    queryKey: ['production', 'search', debounced],
    queryFn: () => api<Page<ProductionRecord>>(`/production?q=${encodeURIComponent(debounced)}&pageSize=5`),
    enabled: open && debounced.length >= 2 && can('production:read'),
  });

  const go = (to: string) => {
    onOpenChange(false);
    setSearch('');
    navigate(to);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('layout.command.title')}
      description={t('layout.command.description')}
    >
      <CommandInput placeholder={t('layout.command.placeholder')} value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>
          {records.isFetching ? t('layout.command.searching') : t('layout.command.empty')}
        </CommandEmpty>
        {!!records.data?.items.length && (
          <CommandGroup heading={t('nav.production')}>
            {records.data.items.map((r) => (
              <CommandItem
                key={r.id}
                value={`${r.productionCode} ${r.tagNumber}`}
                onSelect={() => go(`/production/${r.id}`)}
              >
                <Factory /> <span className="num">{r.productionCode}</span>
                <span className="num ml-auto text-xs text-muted-foreground">{r.tagNumber}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {NAV_SECTIONS.map((section) => (
          <CommandGroup key={section.title} heading={t(section.title)}>
            {section.items
              .filter((i) => !i.action || can(i.action))
              .map(({ to, label, icon: Icon }) => (
                <CommandItem key={to} onSelect={() => go(to)}>
                  <Icon /> {t(label)}
                </CommandItem>
              ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
