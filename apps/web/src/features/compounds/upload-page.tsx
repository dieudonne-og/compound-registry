import { useT } from '@/i18n/i18n';
import { useRef, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { FileWarning } from 'lucide-react';
import { purchaseId as purchaseIdSchema, type ExtractionResult } from '@cr/contracts';
import { ApiError } from '@/lib/api';
import { uploadWithProgress } from '@/lib/upload';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/common/page-header';
import { FieldError } from '@/components/common/field-error';
import { useConfirmCompound } from './api';
import { Dropzone } from './dropzone';
import { ProcessingStages } from './processing-stages';
import { ReviewPanel } from './review-panel';

type Phase =
  { name: 'select' } | { name: 'processing'; pct: number } | { name: 'review'; result: ExtractionResult };

export function Component() {
  const navigate = useNavigate();
  const t = useT();
  const [phase, setPhase] = useState<Phase>({ name: 'select' });
  const [purchaseId, setPurchaseId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ purchaseId?: string; file?: string }>({});
  const [failure, setFailure] = useState<ApiError | null>(null);
  const abort = useRef<AbortController | null>(null);
  const saved = useRef(false); // a ref, because navigation happens before the next render
  const confirm = useConfirmCompound();

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      phase.name !== 'select' && !saved.current && currentLocation.pathname !== nextLocation.pathname,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const pid = purchaseIdSchema.safeParse(purchaseId);
    const next = {
      purchaseId: pid.success ? undefined : pid.error.issues[0]!.message,
      file: file ? undefined : 'upload.chooseReport',
    };
    setErrors(next);
    if (next.purchaseId || next.file || !file) return;

    setFailure(null);
    setPhase({ name: 'processing', pct: 0 });
    abort.current = new AbortController();
    const form = new FormData();
    form.append('purchaseId', pid.data!); // must precede the file
    form.append('file', file);
    try {
      const result = await uploadWithProgress<ExtractionResult>(
        '/compounds/extract',
        form,
        (pct) => setPhase({ name: 'processing', pct }),
        abort.current.signal,
      );
      setPhase({ name: 'review', result });
    } catch (err) {
      setPhase({ name: 'select' });
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof ApiError && err.fieldErrors.purchaseId)
        setErrors({ purchaseId: err.fieldErrors.purchaseId });
      else
        setFailure(
          err instanceof ApiError ? err : new ApiError(0, 'INTERNAL_ERROR', t('upload.processFailed')),
        );
    }
  }

  const reset = () => {
    setPhase({ name: 'select' });
    setFile(null);
    setFailure(null);
  };

  return (
    <>
      <PageHeader title={t('upload.title')} description={t('upload.description')} />

      {phase.name === 'review' && file ? (
        <ReviewPanel
          file={file}
          result={phase.result}
          saving={confirm.isPending}
          onCancel={reset}
          onConfirm={(body) =>
            confirm.mutate(body, {
              onSuccess: ({ id }) => {
                saved.current = true;
                toast.success(t('upload.saved'), {
                  action: { label: t('upload.uploadAnother'), onClick: () => navigate('/compounds/upload') },
                });
                navigate(`/compounds/${id}`);
              },
              onError: (err) =>
                toast.error(err instanceof ApiError ? t(err.message) : t('upload.saveFailed')),
            })
          }
        />
      ) : (
        <div className="max-w-2xl space-y-6">
          {failure && (
            <Alert variant="destructive">
              <FileWarning />
              <AlertTitle>
                {failure.code === 'EXTRACTION_FAILED' ? t('upload.failedRead') : t('upload.failed')}
              </AlertTitle>
              <AlertDescription>{t(failure.message)}</AlertDescription>
            </Alert>
          )}
          {phase.name === 'processing' ? (
            <>
              <ProcessingStages uploadPct={phase.pct} />
              <Button variant="ghost" className="w-full" onClick={() => abort.current?.abort()}>
                {t('common.cancel')}
              </Button>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={submit} noValidate className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="purchaseId">
                      {t('upload.purchaseId')}{' '}
                      <span className="text-destructive" aria-hidden>
                        *
                      </span>
                    </Label>
                    <Input
                      id="purchaseId"
                      value={purchaseId}
                      onChange={(e) => setPurchaseId(e.target.value)}
                      placeholder={t('upload.purchaseIdPlaceholder')}
                      className="num"
                      maxLength={20}
                      aria-invalid={!!errors.purchaseId}
                      aria-describedby="purchaseId-error"
                      autoComplete="off"
                    />
                    <FieldError id="purchaseId-error" message={errors.purchaseId} />
                  </div>
                  <div className="space-y-2">
                    <Label id="report-label">
                      {t('upload.report')}{' '}
                      <span className="text-destructive" aria-hidden>
                        *
                      </span>
                    </Label>
                    <Dropzone
                      labelledBy="report-label"
                      file={file}
                      onFile={(f) => {
                        setFile(f);
                        setErrors((e) => ({ ...e, file: undefined }));
                      }}
                      error={errors.file}
                    />
                  </div>
                  <Button type="submit" size="lg" className="w-full">
                    {t('upload.extract')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <AlertDialog open={blocker.state === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('upload.leave.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('upload.leave.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>{t('upload.leave.stay')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>
              {t('upload.leave.leave')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
