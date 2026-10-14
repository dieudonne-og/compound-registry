import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { changePasswordInput } from '@cr/contracts';
import { useT } from '@/i18n/i18n';
import { applyServerErrors } from '@/lib/forms';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/common/form-field';
import { useChangePassword } from './api';

const schema = changePasswordInput
  .extend({ confirmPassword: changePasswordInput.shape.newPassword })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'settings.password.mismatch',
  });
type Values = { currentPassword: string; newPassword: string; confirmPassword: string };

/** Used both in Settings and on the forced change after a temporary password. */
export function PasswordForm({ onChanged }: { onChanged: () => unknown }) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const change = useChangePassword();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const {
    register,
    formState: { errors },
  } = form;
  const type = visible ? 'text' : 'password';
  const field = (name: keyof Values, label: string, autoComplete: string) => (
    <FormField label={label} htmlFor={name} error={errors[name]?.message}>
      <Input
        id={name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={!!errors[name]}
        aria-describedby={`${name}-error`}
        {...register(name)}
      />
    </FormField>
  );

  const submit = form.handleSubmit(({ currentPassword, newPassword }) =>
    change.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: async () => {
          form.reset();
          await onChanged();
        },
        onError: (err) => {
          if (!applyServerErrors(err, form.setError))
            form.setError('root', { message: err instanceof ApiError ? err.message : 'common.unknownError' });
        },
      },
    ),
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-2">
      {field('currentPassword', t('settings.password.current'), 'current-password')}
      {field('newPassword', t('settings.password.new'), 'new-password')}
      {field('confirmPassword', t('settings.password.confirm'), 'new-password')}
      {errors.root?.message && (
        <p role="alert" className="text-sm text-destructive">
          {t(errors.root.message)}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button type="submit" disabled={change.isPending}>
          {change.isPending && <Loader2 className="animate-spin" />} {t('settings.password.submit')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setVisible((v) => !v)}>
          {visible ? <EyeOff /> : <Eye />}
          {visible ? t('settings.password.hide') : t('settings.password.show')}
        </Button>
      </div>
    </form>
  );
}
