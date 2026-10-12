import { usePreferences } from '@/features/auth/session';
import { useT } from '@/i18n/i18n';
import type { ReactNode } from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type Props<T> = {
  columns: ColumnDef<T, unknown>[];
  data: T[] | undefined;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
  empty: ReactNode;
  renderCard: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  getRowLabel?: (row: T) => string;
};

/** Server-paginated table on desktop; stacked cards below the md breakpoint. */
export function DataTable<T>({
  columns,
  data,
  total,
  page,
  pageSize,
  onPageChange,
  isLoading,
  empty,
  renderCard,
  onRowClick,
  getRowLabel,
}: Props<T>) {
  const t = useT();
  const compact = usePreferences().preferences.density === 'compact';
  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  if (!isLoading && !data?.length) return <>{empty}</>;

  return (
    <div className="space-y-3">
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead
                    key={h.id}
                    aria-sort={
                      (h.column.columnDef.meta as { ariaSort?: 'ascending' | 'descending' | 'none' })
                        ?.ariaSort
                    }
                    className={cn(
                      'h-10 text-xs font-medium text-muted-foreground',
                      (h.column.columnDef.meta as { className?: string })?.className,
                    )}
                  >
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-32" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(onRowClick && 'cursor-pointer')}
                    onClick={() => onRowClick?.(row.original)}
                    onKeyDown={(e) => e.key === 'Enter' && onRowClick?.(row.original)}
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-label={getRowLabel?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          compact ? 'py-2' : 'py-3',
                          (cell.column.columnDef.meta as { className?: string })?.className,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-2 md:hidden">
        {isLoading
          ? Array.from({ length: 4 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-24 w-full rounded-xl" />
              </li>
            ))
          : data?.map((row, i) => <li key={i}>{renderCard(row)}</li>)}
      </ul>

      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <p aria-live="polite" className="num">
          {t('common.pagination.range', { from, to, total })}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label={t('common.pagination.previous')}
          >
            <ChevronLeft />
          </Button>
          <span className="num px-2">
            {page} / {pages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
            aria-label={t('common.pagination.next')}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
