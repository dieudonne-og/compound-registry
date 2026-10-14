import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowRight, ChevronDown, ScrollText } from 'lucide-react';
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_TARGETS,
  type ActivityAction,
  type ActivityEntry,
  type ActivityTarget,
} from '@cr/contracts';
import { useFormat, useT } from '@/i18n/i18n';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/common/data-table';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { usePreferences } from '@/features/auth/session';
import { useActivity } from './api';
import { AdminGuard } from './admin-guard';

const KIND_PREFIX = /^(companies|locations|agents|mineral-types): (.*)$/;

/** Reference entries are logged as "<kind>: <name>"; show the kind in the interface language. */
function useTargetLabel() {
  const t = useT();
  return (e: ActivityEntry) => {
    const m = e.targetType === 'reference' ? KIND_PREFIX.exec(e.targetLabel) : null;
    return m ? `${t(`admin.reference.kinds.${m[1]}`)} · ${m[2]}` : e.targetLabel;
  };
}

function Details({ entry }: { entry: ActivityEntry }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const fields = [...new Set([...Object.keys(entry.before ?? {}), ...Object.keys(entry.after ?? {})])];
  const show = (field: string, value: unknown) => {
    if (value === undefined || value === null) return '—';
    if (field === 'active') return t(value ? 'admin.status.active' : 'admin.status.disabled');
    if (field === 'role') return t(`roles.${String(value)}`);
    return String(value);
  };
  if (!fields.length)
    return <span className="text-xs text-muted-foreground">{t('admin.activity.noDetails')}</span>;
  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <ChevronDown className={open ? 'rotate-180' : ''} />
        {open ? t('admin.activity.hide') : t('admin.activity.show')}
      </Button>
      {open && (
        <ul className="mt-1 space-y-1 text-xs">
          {fields.map((f) => (
            <li key={f} className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground">{t(`admin.activity.fields.${f}`)}</span>
              {entry.before && f in entry.before && (
                <>
                  <span className="line-through">{show(f, entry.before[f])}</span>
                  <ArrowRight className="size-3" aria-hidden />
                </>
              )}
              <span className="font-medium">{show(f, entry.after?.[f])}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Component() {
  const t = useT();
  const format = useFormat();
  const target = useTargetLabel();
  const [params, setParams] = useSearchParams();
  const pageSize = usePreferences().preferences.pageSize;
  const page = Number(params.get('page') ?? 1);
  const targetType = (params.get('targetType') ?? undefined) as ActivityTarget | undefined;
  const action = (params.get('action') ?? undefined) as ActivityAction | undefined;
  const query = useActivity({ page, pageSize, targetType, action });
  const set = (patch: Record<string, string | undefined>) =>
    setParams(
      (p) => {
        for (const [k, v] of Object.entries(patch)) {
          if (v) p.set(k, v);
          else p.delete(k);
        }
        if (!('page' in patch)) p.delete('page');
        return p;
      },
      { replace: true },
    );
  const actions = ACTIVITY_ACTIONS.filter((a) => !targetType || a.startsWith(`${targetType}.`));

  return (
    <AdminGuard>
      <PageHeader title={t('admin.activity.title')} description={t('admin.activity.description')} />
      <div className="mb-4 grid gap-2 sm:grid-cols-[14rem_16rem]">
        <Select
          value={targetType ?? 'all'}
          onValueChange={(v) => set({ targetType: v === 'all' ? undefined : v, action: undefined })}
        >
          <SelectTrigger aria-label={t('admin.activity.type')} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.activity.allTypes')}</SelectItem>
            {ACTIVITY_TARGETS.map((k) => (
              <SelectItem key={k} value={k}>
                {t(`admin.activity.types.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={action ?? 'all'} onValueChange={(v) => set({ action: v === 'all' ? undefined : v })}>
          <SelectTrigger aria-label={t('admin.activity.action')} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.activity.allActions')}</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {t(`admin.activity.actions.${a}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <DataTable
          columns={[
            {
              header: t('admin.activity.columns.when'),
              cell: ({ row }) => (
                <span className="whitespace-nowrap text-muted-foreground">
                  {format.dateTime(row.original.occurredAt)}
                </span>
              ),
            },
            { header: t('admin.activity.columns.who'), cell: ({ row }) => row.original.actor.label },
            {
              header: t('admin.activity.columns.action'),
              cell: ({ row }) => t(`admin.activity.actions.${row.original.action}`),
            },
            { header: t('admin.activity.columns.target'), cell: ({ row }) => target(row.original) },
            {
              header: t('admin.activity.columns.details'),
              cell: ({ row }) => <Details entry={row.original} />,
            },
          ]}
          data={query.data?.items}
          total={query.data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          onPageChange={(p) => set({ page: String(p) })}
          isLoading={query.isLoading}
          empty={<EmptyState icon={ScrollText} title={t('admin.activity.empty')} />}
          renderCard={(e) => (
            <div className="rounded-xl border bg-card p-4 text-sm">
              <p className="font-medium">{t(`admin.activity.actions.${e.action}`)}</p>
              <p className="mt-1">{target(e)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {e.actor.label} · {format.dateTime(e.occurredAt)}
              </p>
              <div className="mt-2">
                <Details entry={e} />
              </div>
            </div>
          )}
        />
      )}
    </AdminGuard>
  );
}
