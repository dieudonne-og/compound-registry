import { Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/common/error-state';
import { useVerify } from './api';

export function VerifyPanel({ id }: { id: number }) {
  const verify = useVerify(id);
  const result = verify.data;

  return (
    <div className="space-y-4" aria-live="polite">
      {verify.error ? (
        <ErrorState error={verify.error} />
      ) : !result ? (
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <ShieldQuestion className="mt-0.5 size-5 shrink-0" />
          <p>Recalculate every hash in this record’s history and compare it with the stored record.</p>
        </div>
      ) : result.status === 'intact' ? (
        <div className="flex items-start gap-3 rounded-lg bg-success-surface p-3 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
          <div>
            <p className="font-medium text-success">History intact</p>
            <p className="text-foreground/80">
              <span className="num">{result.eventsChecked}</span> events verified ·{' '}
              {formatDateTime(new Date(verify.dataUpdatedAt).toISOString())}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg bg-danger-surface p-3 text-sm" role="alert">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">
              Tampering detected{result.failure?.seq ? ` at event #${result.failure.seq}` : ''}
            </p>
            <p className="text-foreground/80">{result.failure?.message}</p>
          </div>
        </div>
      )}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => verify.refetch()}
        disabled={verify.isFetching}
      >
        {verify.isFetching ? <Loader2 className="animate-spin" /> : <ShieldCheck />}{' '}
        {result ? 'Verify again' : 'Verify integrity'}
      </Button>
    </div>
  );
}
