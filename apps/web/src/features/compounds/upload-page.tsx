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
      file: file ? undefined : 'Choose a laboratory report.',
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
          err instanceof ApiError
            ? err
            : new ApiError(0, 'INTERNAL_ERROR', 'The report could not be processed.'),
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
      <PageHeader
        title="Upload laboratory report"
        description="Values are extracted automatically. You review them before anything is saved."
      />

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
                toast.success('Analysis saved', {
                  action: { label: 'Upload another', onClick: () => navigate('/compounds/upload') },
                });
                navigate(`/compounds/${id}`);
              },
              onError: (err) =>
                toast.error(err instanceof ApiError ? err.message : 'Saving failed. Please try again.'),
            })
          }
        />
      ) : (
        <div className="max-w-2xl space-y-6">
          {failure && (
            <Alert variant="destructive">
              <FileWarning />
              <AlertTitle>
                {failure.code === 'EXTRACTION_FAILED' ? 'We could not read this report' : 'Upload failed'}
              </AlertTitle>
              <AlertDescription>{failure.message}</AlertDescription>
            </Alert>
          )}
          {phase.name === 'processing' ? (
            <>
              <ProcessingStages uploadPct={phase.pct} />
              <Button variant="ghost" className="w-full" onClick={() => abort.current?.abort()}>
                Cancel
              </Button>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={submit} noValidate className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="purchaseId">
                      Purchase ID{' '}
                      <span className="text-destructive" aria-hidden>
                        *
                      </span>
                    </Label>
                    <Input
                      id="purchaseId"
                      value={purchaseId}
                      onChange={(e) => setPurchaseId(e.target.value)}
                      placeholder="e.g. PO-2026-0418"
                      className="num"
                      maxLength={20}
                      aria-invalid={!!errors.purchaseId}
                      aria-describedby="purchaseId-error"
                      autoComplete="off"
                    />
                    <FieldError id="purchaseId-error" message={errors.purchaseId} />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Laboratory report{' '}
                      <span className="text-destructive" aria-hidden>
                        *
                      </span>
                    </Label>
                    <Dropzone
                      file={file}
                      onFile={(f) => {
                        setFile(f);
                        setErrors((e) => ({ ...e, file: undefined }));
                      }}
                      error={errors.file}
                    />
                  </div>
                  <Button type="submit" size="lg" className="w-full">
                    Extract values
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
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              The extracted values have not been saved. You will need to upload the report again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
