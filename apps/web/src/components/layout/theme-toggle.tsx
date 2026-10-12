import { usePreferences } from '@/features/auth/session';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { useT } from '@/i18n/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { theme, resolved, setTheme } = useTheme();
  const t = useT();
  const { update } = usePreferences();
  const choose = (next: typeof theme) => {
    setTheme(next);
    update({ theme: next }).catch(() => undefined);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('layout.theme.change')} data-tour="theme">
          {resolved === 'dark' ? <Moon /> : <Sun />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={(v: string) => choose(v as typeof theme)}>
          <DropdownMenuRadioItem value="light">
            <Sun /> {t('layout.theme.light')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon /> {t('layout.theme.dark')}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor /> {t('layout.theme.system')}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
