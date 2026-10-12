import { Link, useParams } from 'react-router';
import { Pencil } from 'lucide-react';
import { formatDate, formatDateTime, formatKg } from '@/lib/format';
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

  const details: [string, React.ReactNode][] = [
    ['Tag number', <span className="num">{r.tagNumber}</span>],
    ['Production date', formatDate(r.productionDate)],
    [
      'Mineral type',
      <>
        {r.mineralType.name}{' '}
        <Badge variant="secondary" className="num ml-1">
          {r.mineralType.code}
        </Badge>
      </>,
    ],
    ['Production weight', <span className="num">{formatKg(r.weightKg)}</span>],
    ['Company', r.company.name],
    ['Business location', r.businessLocation.name],
    ['Traceability agent', r.traceabilityAgent.name],
    ['Operator representative', r.operatorRepresentative],
    ['Registered', `${formatDateTime(r.createdAt)} by ${r.createdBy.name}`],
    ['Last updated', r.updatedBy ? `${formatDateTime(r.updatedAt)} by ${r.updatedBy.name}` : '—'],
  ];

  return (
    <>
      <PageHeader
        title={<span className="num">{r.productionCode}</span>}
        description={`Version ${r.version}`}
        actions={
          can('production:update', { createdBy: r.createdBy.id }) && (
            <Button asChild>
              <Link to={`/production/${r.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
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
              <CardTitle className="text-base">Change history</CardTitle>
              <CardDescription>
                Each entry is linked to the previous one by a keyed hash, so edits or deletions are
                detectable.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!can('audit:read') ? (
                <p className="text-sm text-muted-foreground">
                  The history is available to supervisors, administrators and auditors.
                </p>
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
                <CardTitle className="text-base">Integrity</CardTitle>
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
