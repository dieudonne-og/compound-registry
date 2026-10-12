import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Compass, Mail, Search } from 'lucide-react';
import { useT } from '@/i18n/i18n';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCan } from '@/features/auth/session';
import { ARTICLES, searchArticles, stepKeys, type Article } from './articles';
import { useHelp } from './help-context';

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['?'], label: 'help.shortcuts.help' },
  { keys: ['Ctrl K'], label: 'help.shortcuts.search' },
  { keys: ['g', 'd'], label: 'help.shortcuts.dashboard' },
  { keys: ['g', 'p'], label: 'help.shortcuts.production' },
  { keys: ['g', 'c'], label: 'help.shortcuts.compounds' },
  { keys: ['g', 'u'], label: 'help.shortcuts.upload' },
];

function ArticleItem({ article, onNavigate }: { article: Article; onNavigate: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const id = `help-article-${article.id}`;
  return (
    <li className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/50"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {t(`help.articles.${article.id}.title`)}
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div id={id} className="space-y-3 border-t px-3 py-3">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground/85">
            {stepKeys(article).map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ol>
          <Button asChild variant="outline" size="sm">
            <Link to={article.link} onClick={onNavigate}>
              {t('help.openLink')}
            </Link>
          </Button>
        </div>
      )}
    </li>
  );
}

export function HelpPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const can = useCan();
  const { startTour } = useHelp();
  const [query, setQuery] = useState('');
  const contact = useQuery({
    queryKey: ['help', 'contact'],
    queryFn: () => api<{ email: string | null }>('/help/contact'),
    enabled: open,
    staleTime: 60 * 60_000,
  });
  const visible = ARTICLES.filter((a) => !a.action || can(a.action));
  const articles = searchArticles(query, t, visible);
  const email = contact.data?.email;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('help.title')}</SheetTitle>
          <SheetDescription>{t('help.description')}</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 pb-6">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              startTour();
            }}
          >
            <Compass /> {t('help.tour')}
          </Button>

          <section className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('help.search')}
                aria-label={t('help.search')}
                className="pl-9"
              />
            </div>
            {articles.length ? (
              <ul className="space-y-2">
                {articles.map((a) => (
                  <ArticleItem key={a.id} article={a} onNavigate={() => onOpenChange(false)} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t('help.noResults')}</p>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-medium">{t('help.shortcutsTitle')}</h3>
            <table className="w-full text-sm">
              <tbody>
                {SHORTCUTS.map((s) => (
                  <tr key={s.label} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {s.keys.map((k, i) => (
                        <span key={k}>
                          {i > 0 && (
                            <span className="px-1 text-xs text-muted-foreground">{t('help.then')}</span>
                          )}
                          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
                        </span>
                      ))}
                    </td>
                    <td className="py-2 text-muted-foreground">{t(s.label)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <Mail className="mt-0.5 size-4 shrink-0" />
            <span>
              {email ? (
                <a
                  className="underline-offset-4 hover:text-foreground hover:underline"
                  href={`mailto:${email}`}
                >
                  {t('help.contact', { email })}
                </a>
              ) : (
                t('help.contactNone')
              )}
            </span>
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
