import { useState } from 'react';
import { useParams } from 'react-router';
import { ExternalLink, Info } from 'lucide-react';
import { COMPOUND_CATALOG } from '@cr/contracts';
import { useFormat, useT } from '@/i18n/i18n';
import { openWithSession } from '@/lib/api';
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

export function Component() {
  const id = Number(useParams().id);
  const { data, isLoading, error, refetch } = useCompound(id);
  const [showEmpty, setShowEmpty] = useState(false);
  const t = useT();
  const format = useFormat();

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
        description={
          data.extractionDate
            ? t('compounds.detail.extracted', { date: format.dateTime(data.extractionDate) })
            : undefined
        }
        actions={
          <Button variant="outline" asChild>
            <a
              href={`/api/compounds/${data.id}/file`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault();
                void openWithSession(`/api/compounds/${data.id}/file`);
              }}
            >
              <ExternalLink /> {t('compounds.detail.original')}
            </a>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="text-base">{t('compounds.detail.composition')}</CardTitle>
            <div className="flex items-center gap-2">
              <Switch id="empty" checked={showEmpty} onCheckedChange={setShowEmpty} />
              <Label htmlFor="empty" className="text-sm font-normal">
                {t('compounds.detail.showEmpty')}
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
                      {format.percent(data.values[d.column] ?? null)}
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
              <CardTitle className="text-base">{t('compounds.detail.source')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('compounds.detail.file')}</span>
                <span className="truncate text-right">{data.fileName ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('compounds.detail.method')}</span>
                {data.method ? (
                  <Badge variant="secondary">{t(`compounds.method.${data.method}`)}</Badge>
                ) : (
                  '—'
                )}
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('compounds.detail.confidence')}</span>
                {data.overallConfidence !== null ? <ConfidenceChip value={data.overallConfidence} /> : '—'}
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t('compounds.detail.saved')}</span>
                <span className="num">{data.valuesCount}</span>
              </div>
            </CardContent>
          </Card>
          {data.unmapped.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="size-4" /> {t('compounds.detail.notSaved')}
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
