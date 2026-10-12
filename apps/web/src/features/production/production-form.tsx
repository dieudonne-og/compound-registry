import { useFormat, useT } from '@/i18n/i18n';
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
  optionsWithCurrent,
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
  const t = useT();
  const format = useFormat();
  const retired = (name: string) => t('production.form.retired', { name });
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
          toast.success(
            original
              ? t('production.form.savedToast')
              : t('production.form.registeredToast', { code: record.productionCode }),
          );
          navigate(`/production/${record.id}`);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'VERSION_CONFLICT') return setConflict(true);
          if (err instanceof ApiError && err.code === 'REQUEST_IN_PROGRESS') return; // a double-click; the first submit is still running
          if (!applyServerErrors(err, form.setError))
            toast.error(err instanceof ApiError ? t(err.message) : t('production.form.saveFailed'));
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
            <CardTitle className="text-base">{t('production.form.identification')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            <FormField
              label={t('production.fields.productionCode')}
              htmlFor="productionCode"
              error={err('productionCode')}
              hint={
                original
                  ? codeEditable
                    ? t('production.form.codeHistory')
                    : t('production.form.codeAdmin')
                  : t('production.form.codeGenerated')
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
                {original && !codeEditable && <LockHint text={t('production.form.codeLocked')} />}
              </div>
            </FormField>
            <FormField
              label={t('production.fields.tagNumber')}
              htmlFor="tagNumber"
              required
              error={err('tagNumber')}
            >
              <div className="flex items-center gap-2">
                <Input
                  id="tagNumber"
                  className="num uppercase"
                  autoComplete="off"
                  disabled={criticalLocked}
                  {...register('tagNumber')}
                  {...aria('tagNumber')}
                />
                {criticalLocked && <LockHint text={t('production.form.criticalLocked')} />}
              </div>
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('production.form.production')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            <FormField
              label={t('production.form.productionDate')}
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
            <FormField
              label={t('production.fields.mineralTypeId')}
              htmlFor="mineralTypeId"
              required
              error={err('mineralTypeId')}
            >
              <Controller
                control={control}
                name="mineralTypeId"
                render={({ field }) => (
                  <Combobox
                    id="mineralTypeId"
                    options={optionsWithCurrent(refs.minerals.data, original?.mineralType, retired)}
                    loading={refs.minerals.isLoading}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('production.form.selectMineral')}
                    disabled={criticalLocked}
                    invalid={!!errors.mineralTypeId}
                    aria-describedby="mineralTypeId-error"
                  />
                )}
              />
            </FormField>
            <FormField
              label={t('production.fields.weightKg')}
              htmlFor="weightKg"
              required
              error={err('weightKg')}
              hint={t('production.form.weightHint')}
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
            <CardTitle className="text-base">{t('production.form.parties')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {(
              [
                ['companyId', 'production.form.company', refs.companies, original?.company],
                [
                  'businessLocationId',
                  'production.form.location',
                  refs.locations,
                  original?.businessLocation,
                ],
                ['traceabilityAgentId', 'production.form.agent', refs.agents, original?.traceabilityAgent],
              ] as const
            ).map(([name, label, ref, current]) => (
              <FormField key={name} label={t(label)} htmlFor={name} required error={err(name)}>
                <Controller
                  control={control}
                  name={name}
                  render={({ field }) => (
                    <Combobox
                      id={name}
                      options={optionsWithCurrent(ref.data, current, retired)}
                      loading={ref.isLoading}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t(`production.form.select.${name}`)}
                      invalid={!!errors[name]}
                      aria-describedby={`${name}-error`}
                    />
                  )}
                />
              </FormField>
            ))}
            <FormField
              label={t('production.form.representative')}
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
            <AlertTitle className="text-warning">{t('production.form.recordedTitle')}</AlertTitle>
            <AlertDescription className="w-full space-y-3 text-foreground/80">
              <p>
                {t('production.form.recordedBody', {
                  fields: critical.map((f) => t(`production.fieldsInline.${f}`)).join(', '),
                })}
              </p>
              <FormField label={t('production.form.reason')} htmlFor="reason" required error={err('reason')}>
                <Textarea
                  id="reason"
                  rows={3}
                  maxLength={500}
                  placeholder={t('production.form.reasonPlaceholder')}
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
            <CardTitle className="text-base">
              {original ? t('production.form.saveChanges') : t('production.form.register')}
            </CardTitle>
            <CardDescription>
              {original
                ? t('production.form.editingVersion', { version: original.version })
                : t('production.form.checkDetails')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="space-y-2">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('production.form.tag')}</dt>
                <dd className="num">{values.tagNumber?.toUpperCase() || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('production.form.weight')}</dt>
                <dd className="num">
                  {/^\d+(\.\d+)?$/.test(values.weightKg ?? '') ? format.kg(values.weightKg) : '—'}
                </dd>
              </div>
            </dl>
            <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t bg-background/95 p-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" className="flex-1" disabled={save.isPending}>
                {save.isPending && <Loader2 className="animate-spin" />}{' '}
                {original ? t('production.form.save') : t('production.form.registerShort')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </aside>

      <AlertDialog open={conflict}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('production.form.conflict.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('production.form.conflict.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setConflict(false);
                form.reset(form.getValues());
                void client.invalidateQueries({ queryKey: ['production', original?.id] });
              }}
            >
              {t('production.form.conflict.load')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blocker.state === 'blocked'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('production.form.discard.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('production.form.discard.body')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>
              {t('production.form.discard.keep')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>
              {t('production.form.discard.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
