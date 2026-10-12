import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Factory, Plus, Search, X } from 'lucide-react';
import type { ProductionRecord, ReferenceKind } from '@cr/contracts';
import { formatDate, formatDateTime, formatKg } from '@/lib/format';
import { downloadWithSession } from '@/lib/api';
import { useDebouncedValue } from '@/lib/use-debounced';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/common/data-table';
import { DatePicker } from '@/components/common/date-picker';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { useCan } from '@/features/auth/session';
import { toQueryString, useProductionList, useReference } from './api';

const PAGE_SIZE = 20;

function SortHeader({
  label,
  field,
  sort,
  onSort,
}: {
  label: string;
  field: string;
  sort: string;
  onSort: (s: string) => void;
}) {
  const active = sort.replace('-', '') === field;
  const desc = sort.startsWith('-');
  const Icon = !active ? ArrowUpDown : desc ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-foreground"
      onClick={() => onSort(active && !desc ? `-${field}` : field)}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <Icon className="size-3.5" />
    </button>
  );
}

function RefFilter({
  kind,
  param,
  label,
  params,
  set,
}: {
  kind: ReferenceKind;
  param: string;
  label: string;
  params: URLSearchParams;
  set: (p: Record<string, string | undefined>) => void;
}) {
  const { data } = useReference(kind);
  return (
    <Select
      value={params.get(param) ?? 'all'}
      onValueChange={(v) => set({ [param]: v === 'all' ? undefined : v })}
    >
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label.toLowerCase()}</SelectItem>
        {data?.map((i) => (
          <SelectItem key={i.id} value={String(i.id)}>
            {i.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Component() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const can = useCan();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debounced = useDebouncedValue(search.trim(), 300);
  const sort = params.get('sort') ?? '-createdAt';
  const page = Number(params.get('page') ?? 1);

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
        if ((p.get('q') ?? '') === debounced) return p;
        if (debounced) p.set('q', debounced);
        else p.delete('q');
        p.delete('page');
        return p;
      },
      { replace: true },
    );
  }, [debounced, setParams]);

  const filters = {
    q: params.get('q') ?? undefined,
    mineralTypeId: params.get('mineralTypeId') ?? undefined,
    companyId: params.get('companyId') ?? undefined,
    locationId: params.get('locationId') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
    sort,
  };
  const query = useProductionList({ ...filters, page, pageSize: PAGE_SIZE });
  const filtered = Object.entries(filters).some(([k, v]) => k !== 'sort' && v);

  const ariaSortFor = (field: string) =>
    sort.replace('-', '') === field ? (sort.startsWith('-') ? 'descending' : 'ascending') : 'none';

  const columns: ColumnDef<ProductionRecord, unknown>[] = [
    {
      header: 'Production ID',
      cell: ({ row }) => <span className="num font-medium">{row.original.productionCode}</span>,
    },
    {
      id: 'tag',
      meta: { ariaSort: ariaSortFor('tagNumber') },
      header: () => <SortHeader label="Tag" field="tagNumber" sort={sort} onSort={(s) => set({ sort: s })} />,
      cell: ({ row }) => <span className="num">{row.original.tagNumber}</span>,
    },
    {
      id: 'date',
      meta: { ariaSort: ariaSortFor('productionDate') },
      header: () => (
        <SortHeader label="Date" field="productionDate" sort={sort} onSort={(s) => set({ sort: s })} />
      ),
      cell: ({ row }) => formatDate(row.original.productionDate),
    },
    {
      header: 'Mineral',
      cell: ({ row }) => <Badge variant="secondary">{row.original.mineralType.name}</Badge>,
    },
    {
      id: 'weight',
      meta: { className: 'text-right', ariaSort: ariaSortFor('weightKg') },
      header: () => (
        <SortHeader label="Weight" field="weightKg" sort={sort} onSort={(s) => set({ sort: s })} />
      ),
      cell: ({ row }) => <span className="num">{formatKg(row.original.weightKg)}</span>,
    },
    {
      header: 'Company',
      cell: ({ row }) => <span className="block max-w-44 truncate">{row.original.company.name}</span>,
    },
    {
      header: 'Location',
      cell: ({ row }) => (
        <span className="block max-w-40 truncate">{row.original.businessLocation.name}</span>
      ),
    },
    {
      id: 'updated',
      meta: { ariaSort: ariaSortFor('createdAt') },
      header: () => (
        <SortHeader label="Created" field="createdAt" sort={sort} onSort={(s) => set({ sort: s })} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDateTime(row.original.createdAt)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Production records"
        description="Search, filter and export registered production."
        actions={
          <>
            <Button variant="outline" asChild>
              <a
                href={`/api/production/export.csv?${toQueryString(filters)}`}
                download
                onClick={(e) => {
                  e.preventDefault();
                  void downloadWithSession(`/api/production/export.csv?${toQueryString(filters)}`);
                }}
              >
                <Download /> Export CSV
              </a>
            </Button>
            {can('production:create') && (
              <Button asChild>
                <Link to="/production/new">
                  <Plus /> Register production
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Production ID or tag number"
            className="pl-9"
            aria-label="Search production ID or tag number"
          />
        </div>
        <RefFilter kind="mineral-types" param="mineralTypeId" label="Minerals" params={params} set={set} />
        <RefFilter kind="companies" param="companyId" label="Companies" params={params} set={set} />
        <RefFilter kind="locations" param="locationId" label="Locations" params={params} set={set} />
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
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setParams({}, { replace: true });
            }}
          >
            <X /> Clear filters
          </Button>
        )}
      </div>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.items}
          total={query.data?.total ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={(p) => set({ page: String(p) })}
          isLoading={query.isLoading}
          onRowClick={(r) => navigate(`/production/${r.id}`)}
          getRowLabel={(r) => `Open production ${r.productionCode}`}
          empty={
            <EmptyState
              icon={Factory}
              title={filtered ? 'No records match these filters' : 'No production registered yet'}
              description={
                filtered
                  ? 'Try a broader search or clear the filters.'
                  : 'Registered production batches will appear here.'
              }
              action={
                !filtered &&
                can('production:create') && (
                  <Button asChild>
                    <Link to="/production/new">
                      <Plus /> Register production
                    </Link>
                  </Button>
                )
              }
            />
          }
          renderCard={(r) => (
            <Link
              to={`/production/${r.id}`}
              className="block rounded-xl border bg-card p-4 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="num font-medium">{r.productionCode}</span>
                <Badge variant="secondary">{r.mineralType.code}</Badge>
              </div>
              <p className="num mt-1 text-sm">
                {r.tagNumber} · {formatKg(r.weightKg)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatDate(r.productionDate)} · {r.company.name}
              </p>
            </Link>
          )}
        />
      )}
    </>
  );
}
