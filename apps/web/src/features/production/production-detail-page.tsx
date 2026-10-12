import { InfoTip } from '@/features/help/info-tip';
import { Link, useParams } from 'react-router';
import { Pencil } from 'lucide-react';
import { useFormat, useT } from '@/i18n/i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { useCan } from '@/features/auth/session';
import { useHistory, useProduction } from './api';
import { AuditTimeline } from './audit-timeline';
import { VerifyPanel } from './verify-panel';

export function Component() {
  const id = Number(useParams().id);
  const can = useCan();
  const t = useT();
  const format = useFormat();
  const record = useProduction(id);
  const history = useHistory(id, can('audit:read'));

  if (record.error) return <ErrorState error={record.error} onRetry={() => record.refetch()} />;
  const r = record.data;
  if (!r)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-80 w-full" />
      </div>
    );

  const by = (when: string, name: string) =>
    t('production.detail.byWhen', { when: format.dateTime(when), name });
  const details: [string, React.ReactNode][] = [
    [t('production.fields.tagNumber'), <span className="num">{r.tagNumber}</span>],
    [t('production.detail.productionDate'), format.date(r.productionDate)],
    [
      t('production.fields.mineralTypeId'),
      <>
        {r.mineralType.name}{' '}
        <Badge variant="secondary" className="num ml-1">
          {r.mineralType.code}
        </Badge>
      </>,
    ],
    [t('production.fields.weightKg'), <span className="num">{format.kg(r.weightKg)}</span>],
    [t('production.detail.company'), r.company.name],
    [t('production.detail.location'), r.businessLocation.name],
    [t('production.detail.agent'), r.traceabilityAgent.name],
    [t('production.detail.representative'), r.operatorRepresentative],
    [t('production.detail.registered'), by(r.createdAt, r.createdBy.name)],
    [t('production.detail.lastUpdated'), r.updatedBy ? by(r.updatedAt, r.updatedBy.name) : '—'],
  ];

  return (
    <>
      <PageHeader
        title={<span className="num">{r.productionCode}</span>}
        description={t('production.detail.version', { version: r.version })}
        actions={
          can('production:update', { createdBy: r.createdBy.id }) && (
            <Button asChild>
              <Link to={`/production/${r.id}/edit`}>
                <Pencil /> {t('production.detail.edit')}
              </Link>
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('production.detail.details')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {details.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('production.detail.history')}</CardTitle>
              <CardDescription>{t('production.detail.historyHelp')}</CardDescription>
            </CardHeader>
            <CardContent>
              {!can('audit:read') ? (
                <p className="text-sm text-muted-foreground">{t('production.detail.historyRestricted')}</p>
              ) : history.error ? (
                <ErrorState error={history.error} onRetry={() => history.refetch()} />
              ) : history.data ? (
                <AuditTimeline events={history.data} />
              ) : (
                <Skeleton className="h-40 w-full" />
              )}
            </CardContent>
          </Card>
        </div>
        {can('audit:verify') && (
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1 text-base">
                  {t('production.detail.integrity')}
                  <InfoTip textKey="help.tips.integrity" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VerifyPanel id={r.id} />
              </CardContent>
            </Card>
          </aside>
        )}
      </div>
    </>
  );
}
