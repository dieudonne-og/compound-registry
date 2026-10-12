import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { FlaskConical, Search, Upload } from 'lucide-react';
import type { CompoundSummary } from '@cr/contracts';
import { formatDateTime } from '@/lib/format';
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

const METHOD = { 'text-layer': 'Text layer', ocr: 'OCR', hybrid: 'Mixed' } as const;

const columns: ColumnDef<CompoundSummary, unknown>[] = [
  {
    header: 'Purchase ID',
    cell: ({ row }) => <span className="num font-medium">{row.original.purchaseId}</span>,
  },
  {
    header: 'Report',
    cell: ({ row }) => <span className="block max-w-56 truncate">{row.original.fileName ?? '—'}</span>,
  },
  {
    header: 'Method',
    cell: ({ row }) =>
      row.original.method ? <Badge variant="secondary">{METHOD[row.original.method]}</Badge> : '—',
  },
  {
    header: 'Values',
    meta: { className: 'text-right' },
    cell: ({ row }) => <span className="num">{row.original.valuesCount}</span>,
  },
  {
    header: 'Confidence',
    cell: ({ row }) =>
      row.original.overallConfidence === null ? (
        '—'
      ) : (
        <ConfidenceChip value={row.original.overallConfidence} />
      ),
  },
  {
    header: 'Extracted',
    cell: ({ row }) => (row.original.extractionDate ? formatDateTime(row.original.extractionDate) : '—'),
  },
];

export function Component() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const can = useCan();
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
        title="Compound analyses"
        description="Verified laboratory results saved to the Compound table."
        actions={
          can('compound:extract') && (
            <Button asChild>
              <Link to="/compounds/upload">
                <Upload /> Upload report
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
            placeholder="Search by purchase ID"
            className="pl-9"
            aria-label="Search by purchase ID"
          />
        </div>
        <DatePicker
          value={params.get('from') ?? undefined}
          onChange={(v) => set({ from: v })}
          placeholder="From date"
        />
        <DatePicker
          value={params.get('to') ?? undefined}
          onChange={(v) => set({ to: v })}
          placeholder="To date"
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
          getRowLabel={(r) => `Open analysis for purchase ${r.purchaseId}`}
          empty={
            <EmptyState
              icon={FlaskConical}
              title={filtered ? 'No analyses match these filters' : 'No analyses yet'}
              description={
                filtered
                  ? 'Try a different purchase ID or date range.'
                  : 'Upload a laboratory report to extract and save its compound values.'
              }
              action={
                !filtered &&
                can('compound:extract') && (
                  <Button asChild>
                    <Link to="/compounds/upload">
                      <Upload /> Upload report
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
                <span className="num">{r.valuesCount}</span> values ·{' '}
                {r.extractionDate && formatDateTime(r.extractionDate)}
              </p>
            </Link>
          )}
        />
      )}
    </>
  );
}
