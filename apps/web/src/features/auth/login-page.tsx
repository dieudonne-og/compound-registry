import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, FlaskConical, Loader2, ShieldCheck, ScanText, Link2 } from 'lucide-react';
import { loginInput, type LoginInput, type SessionUser } from '@cr/contracts';
import { api, ApiError } from '@/lib/api';
import { safeNext } from '@/lib/redirect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useT } from '@/i18n/i18n';
import { LanguageSwitch } from '@/components/layout/language-switch';
import { sessionKey, useSession } from './session';

const DEMO = ['admin', 'supervisor', 'operator', 'auditor'];
const FEATURES = [
  { icon: ScanText, text: 'auth.features.read' },
  { icon: ShieldCheck, text: 'auth.features.review' },
  { icon: Link2, text: 'auth.features.history' },
];

export function Component() {
  const { user } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const t = useT();
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginInput),
    defaultValues: { email: '', password: '' },
  });
  const next = safeNext(params.get('next'));

  const login = useMutation({
    mutationFn: (values: LoginInput) =>
      api<{ user: SessionUser }>('/auth/login', { method: 'POST', json: values }),
    onSuccess: ({ user }) => {
      client.setQueryData(sessionKey, user);
      navigate(next, { replace: true });
    },
  });

  if (user) return <Navigate to={next} replace />;

  const error = login.error instanceof ApiError ? login.error : null;
  const errorText =
    error?.code === 'RATE_LIMITED' ? t('auth.tooManyAttempts') : error ? t(error.message) : null;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[oklch(0.3_0.06_200)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(60%_50%_at_20%_10%,oklch(0.6_0.12_190),transparent),radial-gradient(50%_40%_at_90%_90%,oklch(0.5_0.1_240),transparent)]" />
        <div className="relative flex items-center gap-2.5 text-lg font-semibold tracking-tight">
          <span className="grid size-9 place-items-center rounded-lg bg-white/15 ring-1 ring-white/25">
            <FlaskConical className="size-5" />
          </span>
          Compound Registry
        </div>
        <div className="relative max-w-md space-y-8">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-balance">
            {t('auth.tagline')}
          </h1>
          <ul className="space-y-4 text-white/85">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <Icon className="size-5 shrink-0 text-white/70" />
                {t(text)}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-white/60">{t('auth.restricted')}</p>
      </aside>

      <main className="relative flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="absolute top-4 right-4">
          <LanguageSwitch />
        </div>
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold lg:hidden">
              <FlaskConical className="size-5 text-primary" /> Compound Registry
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">{t('auth.signIn')}</h2>
            <p className="text-sm text-muted-foreground">{t('auth.intro')}</p>
          </div>

          <form noValidate onSubmit={form.handleSubmit((v) => login.mutate(v))} className="space-y-5">
            {errorText && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{errorText}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                aria-invalid={!!form.formState.errors.email}
                aria-describedby="email-error"
                {...form.register('email')}
              />
              <p id="email-error" className="text-sm text-destructive" aria-live="polite">
                {t(form.formState.errors.email?.message ?? '')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="pr-10"
                  aria-invalid={!!form.formState.errors.password}
                  aria-describedby="password-error"
                  {...form.register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-2"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p id="password-error" className="text-sm text-destructive" aria-live="polite">
                {t(form.formState.errors.password?.message ?? '')}
              </p>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={login.isPending}>
              {login.isPending && <Loader2 className="animate-spin" />} {t('auth.signIn')}
            </Button>
          </form>

          {import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true' && (
            <div className="rounded-lg border border-dashed p-4 text-sm">
              <p className="mb-2 font-medium">{t('auth.demo.title')}</p>
              <p className="mb-3 text-muted-foreground">
                {t('auth.demo.password', { password: 'Demo!2026' })}
              </p>
              <div className="flex flex-wrap gap-2">
                {DEMO.map((role) => (
                  <Button
                    key={role}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      form.setValue('email', `${role}@example.com`);
                      form.setValue('password', 'Demo!2026');
                    }}
                  >
                    {t(`roles.${role}`)}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
