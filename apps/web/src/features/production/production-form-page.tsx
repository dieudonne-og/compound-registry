import { useParams } from 'react-router';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/error-state';
import { PageHeader } from '@/components/common/page-header';
import { useProduction } from './api';
import { ProductionForm } from './production-form';

export function Component() {
  const { id } = useParams();
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
              Edit <span className="num">{record.data!.productionCode}</span>
            </>
          ) : (
            'Register production'
          )
        }
        description={
          editing
            ? 'Changes to the tag, weight, mineral or ID are added to the audit history.'
            : 'Record a new production batch.'
        }
      />
      {/* key: remount with fresh defaults when a newer version is loaded */}
      <ProductionForm key={record.data?.version ?? 'new'} original={record.data} />
    </>
  );
}
