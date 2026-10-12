import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical, KeyRound } from 'lucide-react';
import { useT } from '@/i18n/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageSwitch } from '@/components/layout/language-switch';
import { fetchSession, sessionKey, useSignOut } from '@/features/auth/session';
import { PasswordForm } from './password-form';

/** Shown, and nothing else is, until a user who signed in with a temporary password chooses their own. */
export function Component() {
  const t = useT();
  const navigate = useNavigate();
  const client = useQueryClient();
  const signOut = useSignOut();
  return (
    <main className="relative grid min-h-dvh place-items-center bg-muted/30 px-4 py-12">
      <div className="absolute top-4 right-4">
        <LanguageSwitch />
      </div>
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2 font-semibold">
          <FlaskConical className="size-5 text-primary" /> Compound Registry
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" /> {t('settings.forced.title')}
            </CardTitle>
            <CardDescription>{t('settings.forced.body')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('settings.password.help')}</p>
            <PasswordForm
              onChanged={async () => {
                await client.fetchQuery({ queryKey: sessionKey, queryFn: fetchSession, staleTime: 0 });
                navigate('/', { replace: true });
              }}
            />
          </CardContent>
        </Card>
        <Button variant="link" className="w-full" onClick={() => signOut.mutate()}>
          {t('settings.forced.signOut')}
        </Button>
      </div>
    </main>
  );
}
