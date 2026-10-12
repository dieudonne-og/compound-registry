import type { VerifyResult } from '@cr/contracts';
import { Loader2, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { useFormat, useT } from '@/i18n/i18n';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/common/error-state';
import { useVerify } from './api';

export function VerifyPanel({ id }: { id: number }) {
  const verify = useVerify(id);
  const t = useT();
  const format = useFormat();
  const result = verify.data;
  const failureText = (f: NonNullable<VerifyResult['failure']>) => {
    if (!f.params && f.reason !== 'NO_EVENTS' && f.reason !== 'MISSING_CREATE') return f.message;
    const params = f.params?.field
      ? { ...f.params, field: t(`production.fieldsInline.${f.params.field}`) }
      : f.params;
    return t(`production.verify.failures.${f.reason}`, params);
  };

  return (
    <div className="space-y-4" aria-live="polite">
      {verify.error ? (
        <ErrorState error={verify.error} />
      ) : !result ? (
        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <ShieldQuestion className="mt-0.5 size-5 shrink-0" />
          <p>{t('production.verify.intro')}</p>
        </div>
      ) : result.status === 'intact' ? (
        <div className="flex items-start gap-3 rounded-lg bg-success-surface p-3 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
          <div>
            <p className="font-medium text-success">{t('production.verify.intact')}</p>
            <p className="text-foreground/80">
              {t('production.verify.eventsVerified', { count: result.eventsChecked })} ·{' '}
              {format.dateTime(new Date(verify.dataUpdatedAt).toISOString())}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg bg-danger-surface p-3 text-sm" role="alert">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">
              {result.failure?.seq
                ? t('production.verify.tamperedAt', { seq: result.failure.seq })
                : t('production.verify.tampered')}
            </p>
            <p className="text-foreground/80">{result.failure && failureText(result.failure)}</p>
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
        {result ? t('production.verify.again') : t('production.verify.start')}
      </Button>
    </div>
  );
}
