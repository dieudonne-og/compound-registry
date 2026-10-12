import { toast } from 'sonner';
import type { Language, PreferencesPatch } from '@cr/contracts';
import { translateIn, useI18n } from '@/i18n/i18n';
import { useTheme } from '@/lib/theme';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/common/page-header';
import { usePreferences, useSession } from '@/features/auth/session';
import { PasswordForm } from './password-form';

const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', fr: 'Français' };

function Choice({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[12rem_1fr] sm:items-center">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full sm:w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function Component() {
  const { t, language, setLanguage, setDateStyle } = useI18n();
  const { setTheme } = useTheme();
  const { user } = useSession();
  const { preferences, update } = usePreferences();

  /** Applies a preference at once and saves it to the account. */
  const save = (patch: PreferencesPatch, apply?: () => void) => {
    apply?.();
    // Answer in the language just chosen, not the one this render was made in.
    const lang = patch.language ?? language;
    update(patch).then(
      () => toast.success(translateIn(lang, 'settings.preferences.saved')),
      () => toast.error(translateIn(lang, 'settings.preferences.saveFailed')),
    );
  };

  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.profile.title')}</CardTitle>
            <CardDescription>{t('settings.profile.help')}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">{t('settings.profile.name')}</dt>
                <dd className="mt-1 font-medium">{user?.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('settings.profile.email')}</dt>
                <dd className="mt-1 truncate">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('settings.profile.role')}</dt>
                <dd className="mt-1">
                  {user && <Badge variant="secondary">{t(`roles.${user.role}`)}</Badge>}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.preferences.title')}</CardTitle>
            <CardDescription>{t('settings.preferences.help')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Choice
              id="pref-language"
              label={t('settings.preferences.language')}
              value={language}
              options={(Object.keys(LANGUAGE_NAMES) as Language[]).map((l) => ({
                value: l,
                label: LANGUAGE_NAMES[l],
              }))}
              onChange={(v) => save({ language: v as Language }, () => setLanguage(v as Language))}
            />
            <Choice
              id="pref-theme"
              label={t('settings.preferences.theme')}
              value={preferences.theme}
              options={(['light', 'dark', 'system'] as const).map((v) => ({
                value: v,
                label: t(`layout.theme.${v}`),
              }))}
              onChange={(v) => {
                const theme = v as PreferencesPatch['theme'] & string;
                save({ theme }, () => setTheme(theme));
              }}
            />
            <Choice
              id="pref-density"
              label={t('settings.preferences.density')}
              value={preferences.density}
              options={(['comfortable', 'compact'] as const).map((v) => ({
                value: v,
                label: t(`settings.preferences.densities.${v}`),
              }))}
              onChange={(v) => save({ density: v as 'comfortable' | 'compact' })}
            />
            <Choice
              id="pref-page-size"
              label={t('settings.preferences.pageSize')}
              value={String(preferences.pageSize)}
              options={['10', '20', '50'].map((v) => ({ value: v, label: v }))}
              onChange={(v) => save({ pageSize: Number(v) as 10 | 20 | 50 })}
            />
            <Choice
              id="pref-date-style"
              label={t('settings.preferences.dateStyle')}
              value={preferences.dateStyle}
              options={(['local', 'iso'] as const).map((v) => ({
                value: v,
                label: t(`settings.preferences.dateStyles.${v}`),
              }))}
              onChange={(v) => {
                const style = v as 'local' | 'iso';
                save({ dateStyle: style }, () => setDateStyle(style));
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.password.title')}</CardTitle>
            <CardDescription>{t('settings.password.help')}</CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm onChanged={() => void toast.success(t('settings.password.changed'))} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
