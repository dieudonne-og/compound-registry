import { useT } from '@/i18n/i18n';
import { useParams } from 'react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { useProduction } from './api';
import { ProductionForm } from './production-form';

export function Component() {
  const { id } = useParams();
  const t = useT();
  const editing = id !== undefined;
  const record = useProduction(Number(id), editing);

  if (editing && record.error) return <ErrorState error={record.error} onRetry={() => record.refetch()} />;
  if (editing && !record.data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );

  return (
    <>
      <PageHeader
        title={
          editing ? (
            <>
              {t('production.page.edit')} <span className="num">{record.data!.productionCode}</span>
            </>
          ) : (
            t('production.page.register')
          )
        }
        description={editing ? t('production.page.editDescription') : t('production.page.newDescription')}
      />
      {/* key: remount with fresh defaults when a newer version is loaded */}
      <ProductionForm key={record.data?.version ?? 'new'} original={record.data} />
    </>
  );
}
