import { useRef, useState } from 'react';
import { useBlocker, useNavigate } from 'react-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { History, Loader2, Lock } from 'lucide-react';
import type { ProductionRecord } from '@cr/contracts';
import { ApiError } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import { formatKg } from '@/lib/format';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Combobox } from '@/components/common/combobox';
import { DatePicker } from '@/components/common/date-picker';
import { ErrorState } from '@/components/common/error-state';
import { FormField } from '@/components/common/form-field';
import { useCan } from '@/features/auth/session';
import { useReference, useSaveProduction } from './api';
import {
  changedCriticalFields,
  CRITICAL_LABELS,
  productionFormSchema,
  toFormValues,
  type ProductionFormValues,
} from './form-logic';

const LockHint = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Lock className="size-3.5 text-muted-foreground" aria-label={text} />
    </TooltipTrigger>
    <TooltipContent>{text}</TooltipContent>
  </Tooltip>
);

export function ProductionForm({ original }: { original?: ProductionRecord }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const can = useCan();
  const save = useSaveProduction();
  const idempotencyKey = useRef(crypto.randomUUID());
  const leaving = useRef(false); // set before navigating after a save, so the unsaved-changes guard stays quiet
  const [conflict, setConflict] = useState(false);
  const refs = {
    minerals: useReference('mineral-types'),
    companies: useReference('companies'),
    locations: useReference('locations'),
    agents: useReference('agents'),
  };

  const form = useForm<ProductionFormValues>({
    resolver: zodResolver(productionFormSchema(original)) as never,
    defaultValues: toFormValues(original),
    mode: 'onTouched',
  });
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = form;
  const values = useWatch({ control }) as ProductionFormValues;
  const critical = original ? changedCriticalFields(original, values) : [];
  const criticalLocked = !!original && !can('production:update-critical');
  const codeEditable = !!original && can('production:update-code');

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  );

  const refError = Object.values(refs).find((r) => r.error)?.error;
  if (refError)
    return <ErrorState error={refError} onRetry={() => Object.values(refs).forEach((r) => r.refetch())} />;

  const options = (items: { id: number; name: string; code?: string | null }[] | undefined) =>
    (items ?? []).map((i) => ({ value: i.id, label: i.name, hint: i.code }));

  // handleSubmit only calls this on submit, never during render, so reading refs here is safe.
  // eslint-disable-next-line react-hooks/refs
  const onSubmit = handleSubmit((v) =>
    save.mutate(
      { original, values: v, idempotencyKey: idempotencyKey.current },
      {
        onSuccess: (record) => {
          leaving.current = true;
          idempotencyKey.current = crypto.randomUUID();
          form.reset(toFormValues(record));
          toast.success(original ? 'Changes saved' : `Registered ${record.productionCode}`);
          navigate(`/production/${record.id}`);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') return setConflict(true);
          if (err instanceof ApiError && err.code === 'REQUEST_IN_PROGRESS') return; // a double-click; the first submit is still running
          if (!applyServerErrors(err, form.setError))
            toast.error(err instanceof ApiError ? err.message : 'Saving failed. Please try again.');
        },
      },
    ),
  );

  const err = (name: keyof ProductionFormValues) => errors[name]?.message as string | undefined;
  const aria = (name: keyof ProductionFormValues) => ({
    'aria-invalid': !!errors[name],
    'aria-describedby': `${name}-error`,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 pb-24 lg:grid-cols-[1fr_20rem] lg:pb-0">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identification</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            <FormField
              label="Production ID"
              htmlFor="productionCode"
              error={err('productionCode')}
              hint={
                original
                  ? codeEditable
                    ? 'Changing the ID is recorded in the history.'
                    : 'Only administrators can change the ID.'
                  : 'Generated automatically when you save.'
              }
            >
              <div className="flex items-center gap-2">
                <Input
                  id="productionCode"
                  className="num"
                  disabled={!codeEditable}
                  placeholder={original ? undefined : 'PRD-YYYY-NNNNNN'}
                  {...register('productionCode')}
                  {...aria('productionCode')}
                />
                {original && !codeEditable && (
                  <LockHint text="Only administrators can change the production ID" />
                )}
              </div>
            </FormField>
            <FormField label="Tag number" htmlFor="tagNumber" required error={err('tagNumber')}>
              <div className="flex items-center gap-2">
                <Input
                  id="tagNumber"
                  className="num uppercase"
                  autoComplete="off"
                  disabled={criticalLocked}
                  {...register('tagNumber')}
                  {...aria('tagNumber')}
                />
                {criticalLocked && <LockHint text="Only supervisors and administrators can change this" />}
              </div>
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Production</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            <FormField
              label="Production date"
              htmlFor="productionDate"
              required
              error={err('productionDate')}
            >
              <Controller
                control={control}
                name="productionDate"
                render={({ field }) => (
                  <DatePicker
                    id="productionDate"
                    value={field.value || undefined}
                    onChange={(v) => field.onChange(v ?? '')}
                    disableFuture
                    {...aria('productionDate')}
                    invalid={!!errors.productionDate}
                  />
                )}
              />
            </FormField>
            <FormField label="Mineral type" htmlFor="mineralTypeId" required error={err('mineralTypeId')}>
              <Controller
                control={control}
                name="mineralTypeId"
                render={({ field }) => (
                  <Combobox
                    id="mineralTypeId"
                    options={options(refs.minerals.data)}
                    loading={refs.minerals.isLoading}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select mineral"
                    disabled={criticalLocked}
                    invalid={!!errors.mineralTypeId}
                    aria-describedby="mineralTypeId-error"
                  />
                )}
              />
            </FormField>
            <FormField
              label="Production weight"
              htmlFor="weightKg"
              required
              error={err('weightKg')}
              hint="Greater than zero, up to 3 decimals."
            >
              <div className="relative">
                <Input
                  id="weightKg"
                  inputMode="decimal"
                  className="num pr-10"
                  disabled={criticalLocked}
                  {...register('weightKg')}
                  {...aria('weightKg')}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-muted-foreground">
                  kg
                </span>
              </div>
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parties</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {(
              [
                ['companyId', 'Company', refs.companies],
                ['businessLocationId', 'Business location', refs.locations],
                ['traceabilityAgentId', 'Traceability agent', refs.agents],
              ] as const
            ).map(([name, label, ref]) => (
              <FormField key={name} label={label} htmlFor={name} required error={err(name)}>
                <Controller
                  control={control}
                  name={name}
                  render={({ field }) => (
                    <Combobox
                      id={name}
                      options={options(ref.data)}
                      loading={ref.isLoading}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={`Select ${label.toLowerCase()}`}
                      invalid={!!errors[name]}
                      aria-describedby={`${name}-error`}
                    />
                  )}
                />
              </FormField>
            ))}
            <FormField
              label="Operator representative"
              htmlFor="operatorRepresentative"
              required
              error={err('operatorRepresentative')}
            >
              <Input
                id="operatorRepresentative"
                autoComplete="name"
                {...register('operatorRepresentative')}
                {...aria('operatorRepresentative')}
              />
            </FormField>
          </CardContent>
        </Card>

        {critical.length > 0 && (
          <Alert className="border-warning-border bg-warning-surface">
            <History className="text-warning" />
            <AlertTitle className="text-warning">
              This change will be recorded in the tamper-evident history
            </AlertTitle>
            <AlertDescription className="w-full space-y-3 text-foreground/80">
              <p>
                Changing {critical.map((f) => CRITICAL_LABELS[f]).join(', ')} needs a reason that auditors
                will see.
              </p>
              <FormField label="Reason for change" htmlFor="reason" required error={err('reason')}>
                <Textarea
                  id="reason"
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Re-weighed on the certified warehouse scale"
                  className="bg-background"
                  {...register('reason')}
                  {...aria('reason')}
                />
              </FormField>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{original ? 'Save changes' : 'Register production'}</CardTitle>
            <CardDescription>
              {original ? `Editing version ${original.version}.` : 'Check the details before saving.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="space-y-2">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Tag</dt>
                <dd className="num">{values.tagNumber?.toUpperCase() || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Weight</dt>
                <dd className="num">
                  {/^\d+(\.\d+)?$/.test(values.weightKg ?? '') ? formatKg(values.weightKg) : '—'}
                </dd>
              </div>
            </dl>
            <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t bg-background/95 p-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={save.isPending}>
                {save.isPending && <Loader2 className="animate-spin" />} {original ? 'Save' : 'Register'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </aside>

      <AlertDialog open={conflict}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This record was changed by someone else</AlertDialogTitle>
            <AlertDialogDescription>
              Your changes were not saved. Load the latest version, then make your changes again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setConflict(false);
                form.reset(form.getValues());
                void client.invalidateQueries({ queryKey: ['production', original?.id] });
              }}
            >
              Load latest version
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blocker.state === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>You have changes that have not been saved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
