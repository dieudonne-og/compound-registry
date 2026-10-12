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
import { formatKg } from '@/lib/format';
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
  const { data, error, refetch, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardSummary>('/dashboard/summary'),
    refetchInterval: 60_000,
  });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user?.name.split(' ')[0] ?? ''}`}
        description="Production and laboratory activity at a glance."
        actions={
          <>
            {can('compound:extract') && (
              <Button variant="outline" asChild>
                <Link to="/compounds/upload">
                  <Upload /> Upload report
                </Link>
              </Button>
            )}
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
              label="Records this month"
              value={data.productionThisMonth}
              icon={Factory}
              href="/production"
            />
            <StatTile
              label="Weight this month"
              value={formatKg(data.weightThisMonthKg).replace(' kg', '')}
              hint="kilograms"
              icon={Scale}
            />
            <StatTile
              label="Lab reports saved"
              value={data.reportsProcessed}
              icon={FlaskConical}
              href="/compounds"
            />
            <StatTile
              label="Awaiting review"
              value={data.pendingReviews}
              hint="uploaded but not yet confirmed"
              icon={ClipboardCheck}
              tone={data.pendingReviews ? 'warning' : 'default'}
            />
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Production by mineral</CardTitle>
                <CardDescription>Total registered weight</CardDescription>
              </CardHeader>
              <CardContent>
                {data.weightByMineral.length ? (
                  <WeightByMineralChart data={data.weightByMineral} />
                ) : (
                  <p className="text-sm text-muted-foreground">No production registered yet.</p>
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
                      <CardTitle className="text-base">Audit trail</CardTitle>
                      <CardDescription>
                        {data.chainHealth.tampered ? (
                          <span className="text-destructive">
                            <span className="num">{data.chainHealth.tampered}</span> record(s) failed
                            verification
                          </span>
                        ) : (
                          <>
                            All <span className="num">{data.chainHealth.intact}</span> records verified
                          </>
                        )}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent activity</CardTitle>
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
