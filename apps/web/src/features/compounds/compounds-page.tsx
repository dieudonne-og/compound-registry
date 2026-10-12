import { useEffect, useMemo, useState } from 'react';
import { useFormat, useT } from '@/i18n/i18n';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { FlaskConical, Search, Upload } from 'lucide-react';
import type { CompoundSummary } from '@cr/contracts';
import { useDebouncedValue } from '@/lib/use-debounced';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/common/page-header';
import { DataTable } from '@/components/common/data-table';
import { DatePicker } from '@/components/common/date-picker';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { ConfidenceChip } from '@/components/common/confidence-chip';
import { useCan } from '@/features/auth/session';
import { useCompounds } from './api';

function useColumns(): ColumnDef<CompoundSummary, unknown>[] {
  const t = useT();
  const format = useFormat();
  return useMemo(
    () => [
      {
        header: t('compounds.list.columns.purchaseId'),
        cell: ({ row }) => <span className="num font-medium">{row.original.purchaseId}</span>,
      },
      {
        header: t('compounds.list.columns.report'),
        cell: ({ row }) => <span className="block max-w-56 truncate">{row.original.fileName ?? '—'}</span>,
      },
      {
        header: t('compounds.list.columns.method'),
        cell: ({ row }) =>
          row.original.method ? (
            <Badge variant="secondary">{t(`compounds.method.${row.original.method}`)}</Badge>
          ) : (
            '—'
          ),
      },
      {
        header: t('compounds.list.columns.values'),
        meta: { className: 'text-right' },
        cell: ({ row }) => <span className="num">{row.original.valuesCount}</span>,
      },
      {
        header: t('compounds.list.columns.confidence'),
        cell: ({ row }) =>
          row.original.overallConfidence === null ? (
            '—'
          ) : (
            <ConfidenceChip value={row.original.overallConfidence} />
          ),
      },
      {
        header: t('compounds.list.columns.extracted'),
        cell: ({ row }) => (row.original.extractionDate ? format.dateTime(row.original.extractionDate) : '—'),
      },
    ],
    [t, format],
  );
}

export function Component() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const can = useCan();
  const t = useT();
  const format = useFormat();
  const columns = useColumns();
  const page = Number(params.get('page') ?? 1);
  const [search, setSearch] = useState(params.get('purchaseId') ?? '');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
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

  useEffect(() => {
    setParams(
      (p) => {
        if ((p.get('purchaseId') ?? '') === debouncedSearch) return p;
        if (debouncedSearch) p.set('purchaseId', debouncedSearch);
        else p.delete('purchaseId');
        p.delete('page');
        return p;
      },
      { replace: true },
    );
  }, [debouncedSearch, setParams]);

  const query = useCompounds({
    page,
    pageSize: 20,
    purchaseId: params.get('purchaseId') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  });
  const filtered = !!(params.get('purchaseId') || params.get('from') || params.get('to'));

  return (
    <>
      <PageHeader
        title={t('compounds.list.title')}
        description={t('compounds.list.description')}
        actions={
          can('compound:extract') && (
            <Button asChild>
              <Link to="/compounds/upload">
                <Upload /> {t('compounds.list.upload')}
              </Link>
            </Button>
          )
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_11rem_11rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('compounds.list.search')}
            className="pl-9"
            aria-label={t('compounds.list.search')}
          />
        </div>
        <DatePicker
          value={params.get('from') ?? undefined}
          onChange={(v) => set({ from: v })}
          placeholder={t('compounds.list.from')}
        />
        <DatePicker
          value={params.get('to') ?? undefined}
          onChange={(v) => set({ to: v })}
          placeholder={t('compounds.list.to')}
        />
      </div>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.items}
          total={query.data?.total ?? 0}
          page={page}
          pageSize={20}
          onPageChange={(p) => set({ page: String(p) })}
          isLoading={query.isLoading}
          onRowClick={(r) => navigate(`/compounds/${r.id}`)}
          getRowLabel={(r) => t('compounds.list.rowLabel', { purchaseId: r.purchaseId })}
          empty={
            <EmptyState
              icon={FlaskConical}
              title={filtered ? t('compounds.list.emptyFiltered') : t('compounds.list.empty')}
              description={filtered ? t('compounds.list.emptyFilteredHelp') : t('compounds.list.emptyHelp')}
              action={
                !filtered &&
                can('compound:extract') && (
                  <Button asChild>
                    <Link to="/compounds/upload">
                      <Upload /> {t('compounds.list.upload')}
                    </Link>
                  </Button>
                )
              }
            />
          }
          renderCard={(r) => (
            <Link
              to={`/compounds/${r.id}`}
              className="block rounded-xl border bg-card p-4 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="num font-medium">{r.purchaseId}</span>
                {r.overallConfidence !== null && <ConfidenceChip value={r.overallConfidence} />}
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">{r.fileName}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="num">{t('compounds.list.valuesCount', { count: r.valuesCount })}</span> ·{' '}
                {r.extractionDate && format.dateTime(r.extractionDate)}
              </p>
            </Link>
          )}
        />
      )}
    </>
  );
}
