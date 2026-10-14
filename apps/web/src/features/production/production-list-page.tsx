import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Factory, Plus, Search, X } from 'lucide-react';
import type { ProductionRecord, ReferenceKind } from '@cr/contracts';
import { useFormat, useT } from '@/i18n/i18n';
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
import { useCan, usePreferences } from '@/features/auth/session';
import { toQueryString, useProductionList, useReference } from './api';

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
  const t = useT();
  const Icon = !active ? ArrowUpDown : desc ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-foreground"
      onClick={() => onSort(active && !desc ? `-${field}` : field)}
      aria-label={t('production.list.sortBy', { label })}
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
  allLabel,
  params,
  set,
}: {
  kind: ReferenceKind;
  param: string;
  label: string;
  allLabel: string;
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
        <SelectItem value="all">{allLabel}</SelectItem>
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
  const t = useT();
  const format = useFormat();
  const pageSize = usePreferences().preferences.pageSize;
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
  const query = useProductionList({ ...filters, page, pageSize });
  const filtered = Object.entries(filters).some(([k, v]) => k !== 'sort' && v);

  const ariaSortFor = (field: string) =>
    sort.replace('-', '') === field ? (sort.startsWith('-') ? 'descending' : 'ascending') : 'none';

  const columns: ColumnDef<ProductionRecord, unknown>[] = [
    {
      header: t('production.list.columns.productionId'),
      cell: ({ row }) => <span className="num font-medium">{row.original.productionCode}</span>,
    },
    {
      id: 'tag',
      meta: { ariaSort: ariaSortFor('tagNumber') },
      header: () => (
        <SortHeader
          label={t('production.list.columns.tag')}
          field="tagNumber"
          sort={sort}
          onSort={(s) => set({ sort: s })}
        />
      ),
      cell: ({ row }) => <span className="num">{row.original.tagNumber}</span>,
    },
    {
      id: 'date',
      meta: { ariaSort: ariaSortFor('productionDate') },
      header: () => (
        <SortHeader
          label={t('production.list.columns.date')}
          field="productionDate"
          sort={sort}
          onSort={(s) => set({ sort: s })}
        />
      ),
      cell: ({ row }) => format.date(row.original.productionDate),
    },
    {
      header: t('production.list.columns.mineral'),
      cell: ({ row }) => <Badge variant="secondary">{row.original.mineralType.name}</Badge>,
    },
    {
      id: 'weight',
      meta: { className: 'text-right', ariaSort: ariaSortFor('weightKg') },
      header: () => (
        <SortHeader
          label={t('production.list.columns.weight')}
          field="weightKg"
          sort={sort}
          onSort={(s) => set({ sort: s })}
        />
      ),
      cell: ({ row }) => <span className="num">{format.kg(row.original.weightKg)}</span>,
    },
    {
      header: t('production.list.columns.company'),
      cell: ({ row }) => <span className="block max-w-44 truncate">{row.original.company.name}</span>,
    },
    {
      header: t('production.list.columns.location'),
      cell: ({ row }) => (
        <span className="block max-w-40 truncate">{row.original.businessLocation.name}</span>
      ),
    },
    {
      id: 'updated',
      meta: { ariaSort: ariaSortFor('createdAt') },
      header: () => (
        <SortHeader
          label={t('production.list.columns.created')}
          field="createdAt"
          sort={sort}
          onSort={(s) => set({ sort: s })}
        />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{format.dateTime(row.original.createdAt)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('production.list.title')}
        description={t('production.list.description')}
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
                <Download /> {t('production.list.export')}
              </a>
            </Button>
            {can('production:create') && (
              <Button asChild>
                <Link to="/production/new">
                  <Plus /> {t('production.list.register')}
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
            placeholder={t('production.list.search')}
            className="pl-9"
            aria-label={t('production.list.searchLabel')}
          />
        </div>
        <RefFilter
          kind="mineral-types"
          param="mineralTypeId"
          label={t('production.list.filters.minerals')}
          allLabel={t('production.list.filters.allMinerals')}
          params={params}
          set={set}
        />
        <RefFilter
          kind="companies"
          param="companyId"
          label={t('production.list.filters.companies')}
          allLabel={t('production.list.filters.allCompanies')}
          params={params}
          set={set}
        />
        <RefFilter
          kind="locations"
          param="locationId"
          label={t('production.list.filters.locations')}
          allLabel={t('production.list.filters.allLocations')}
          params={params}
          set={set}
        />
        <DatePicker
          value={params.get('from') ?? undefined}
          onChange={(v) => set({ from: v })}
          placeholder={t('production.list.from')}
        />
        <DatePicker
          value={params.get('to') ?? undefined}
          onChange={(v) => set({ to: v })}
          placeholder={t('production.list.to')}
        />
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setParams({}, { replace: true });
            }}
          >
            <X /> {t('production.list.clear')}
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
          pageSize={pageSize}
          onPageChange={(p) => set({ page: String(p) })}
          isLoading={query.isLoading}
          onRowClick={(r) => navigate(`/production/${r.id}`)}
          getRowLabel={(r) => t('production.list.rowLabel', { code: r.productionCode })}
          empty={
            <EmptyState
              icon={Factory}
              title={filtered ? t('production.list.emptyFiltered') : t('production.list.empty')}
              description={filtered ? t('production.list.emptyFilteredHelp') : t('production.list.emptyHelp')}
              action={
                !filtered &&
                can('production:create') && (
                  <Button asChild>
                    <Link to="/production/new">
                      <Plus /> {t('production.list.register')}
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
                {r.tagNumber} · {format.kg(r.weightKg)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {format.date(r.productionDate)} · {r.company.name}
              </p>
            </Link>
          )}
        />
      )}
    </>
  );
}
