import { useState } from 'react';
import { useParams } from 'react-router';
import { ExternalLink, Info } from 'lucide-react';
import { COMPOUND_CATALOG } from '@cr/contracts';
import { formatDateTime, formatPercent } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ConfidenceChip } from '@/components/common/confidence-chip';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { useCompound } from './api';

const METHOD_LABEL = { 'text-layer': 'Text layer', ocr: 'Text recognition', hybrid: 'Mixed' } as const;

export function Component() {
  const id = Number(useParams().id);
  const { data, isLoading, error, refetch } = useCompound(id);
  const [showEmpty, setShowEmpty] = useState(false);

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );

  const rows = COMPOUND_CATALOG.filter((d) => showEmpty || data.values[d.column] !== null);

  return (
    <>
      <PageHeader
        title={<span className="num">{data.purchaseId}</span>}
        description={data.extractionDate ? `Extracted ${formatDateTime(data.extractionDate)}` : undefined}
        actions={
          <Button variant="outline" asChild>
            <a href={`/api/compounds/${data.id}/file`} target="_blank" rel="noopener noreferrer">
              <ExternalLink /> Original report
            </a>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="text-base">Composition</CardTitle>
            <div className="flex items-center gap-2">
              <Switch id="empty" checked={showEmpty} onCheckedChange={setShowEmpty} />
              <Label htmlFor="empty" className="text-sm font-normal">
                Show empty columns
              </Label>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <dl className="-mr-px -mb-px grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
                {rows.map((d) => (
                  <div key={d.column} className="border-r border-b p-3">
                    <dt className="num text-xs text-muted-foreground">{d.label}</dt>
                    <dd
                      className={`num mt-1 text-lg font-medium ${data.values[d.column] === null ? 'text-muted-foreground' : ''}`}
                    >
                      {formatPercent(data.values[d.column] ?? null)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">File</span>
                <span className="truncate text-right">{data.fileName ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Method</span>
                {data.method ? <Badge variant="secondary">{METHOD_LABEL[data.method]}</Badge> : '—'}
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Confidence</span>
                {data.overallConfidence !== null ? <ConfidenceChip value={data.overallConfidence} /> : '—'}
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Values saved</span>
                <span className="num">{data.valuesCount}</span>
              </div>
            </CardContent>
          </Card>
          {data.unmapped.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="size-4" /> Not saved
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {data.unmapped.map((u, i) => (
                    <li key={i} className="num flex justify-between">
                      <span>{u.label}</span>
                      <span>{u.value ?? '—'} %</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
