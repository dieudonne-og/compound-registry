import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardCheck,
  Factory,
  FlaskConical,
  Plus,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import type { DashboardSummary } from '@cr/contracts';
import { api } from '@/lib/api';
import { useFormat, useT } from '@/i18n/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { StatTile } from '@/components/common/stat-tile';
import { useCan, useSession } from '@/features/auth/session';
import { RecentActivity } from './recent-activity';
import { WeightByMineralChart } from './weight-by-mineral-chart';

export function Component() {
  const { user } = useSession();
  const can = useCan();
  const t = useT();
  const format = useFormat();
  const { data, error, refetch, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardSummary>('/dashboard/summary'),
    refetchInterval: 60_000,
  });
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

  return (
    <>
      <PageHeader
        title={t(`dashboard.greeting.${part}`, { name: user?.name.split(' ')[0] ?? '' })}
        description={t('dashboard.description')}
        actions={
          <>
            {can('compound:extract') && (
              <Button variant="outline" asChild>
                <Link to="/compounds/upload">
                  <Upload /> {t('dashboard.upload')}
                </Link>
              </Button>
            )}
            {can('production:create') && (
              <Button asChild>
                <Link to="/production/new">
                  <Plus /> {t('dashboard.register')}
                </Link>
              </Button>
            )}
          </>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatTile
              label={t('dashboard.tiles.records')}
              value={data.productionThisMonth}
              icon={Factory}
              href="/production"
            />
            <StatTile
              label={t('dashboard.tiles.weight')}
              value={format.kg(data.weightThisMonthKg).replace(/\s?kg$/, '')}
              hint={t('dashboard.tiles.kilograms')}
              icon={Scale}
            />
            <StatTile
              label={t('dashboard.tiles.reports')}
              value={data.reportsProcessed}
              icon={FlaskConical}
              href="/compounds"
            />
            <StatTile
              label={t('dashboard.tiles.pending')}
              value={data.pendingReviews}
              hint={t('dashboard.tiles.pendingHint')}
              icon={ClipboardCheck}
              tone={data.pendingReviews ? 'warning' : 'default'}
            />
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('dashboard.byMineral')}</CardTitle>
                <CardDescription>{t('dashboard.byMineralHelp')}</CardDescription>
              </CardHeader>
              <CardContent>
                {data.weightByMineral.length ? (
                  <WeightByMineralChart data={data.weightByMineral} />
                ) : (
                  <p className="text-sm text-muted-foreground">{t('dashboard.noProduction')}</p>
                )}
              </CardContent>
            </Card>
            <div className="space-y-6">
              {data.chainHealth && (
                <Card className={data.chainHealth.tampered ? 'border-destructive/40' : undefined}>
                  <CardHeader className="flex-row items-center gap-3 space-y-0">
                    {data.chainHealth.tampered ? (
                      <ShieldAlert className="size-5 text-destructive" />
                    ) : (
                      <ShieldCheck className="size-5 text-success" />
                    )}
                    <div>
                      <CardTitle className="text-base">{t('dashboard.audit')}</CardTitle>
                      <CardDescription>
                        {data.chainHealth.tampered ? (
                          <span className="text-destructive">
                            {t('dashboard.tampered', { count: data.chainHealth.tampered })}
                          </span>
                        ) : (
                          t('dashboard.verified', { count: data.chainHealth.intact })
                        )}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('dashboard.recent')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <RecentActivity items={data.recentActivity} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
