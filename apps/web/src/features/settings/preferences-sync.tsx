import { useEffect } from 'react';
import { useI18n } from '@/i18n/i18n';
import { useTheme } from '@/lib/theme';
import { useSession } from '@/features/auth/session';

/** Applies the signed-in user's saved language, theme and date style when their session loads or changes. */
export function PreferencesSync() {
  const { user, preferences } = useSession();
  const { setLanguage, setDateStyle } = useI18n();
  const { setTheme } = useTheme();
  const signedIn = !!user;
  const { language, theme, dateStyle } = preferences;

  useEffect(() => {
    if (signedIn && language) setLanguage(language);
  }, [signedIn, language, setLanguage]);
  useEffect(() => {
    if (signedIn) setTheme(theme);
  }, [signedIn, theme, setTheme]);
  useEffect(() => {
    setDateStyle(signedIn ? dateStyle : 'local');
  }, [signedIn, dateStyle, setDateStyle]);
  return null;
}
