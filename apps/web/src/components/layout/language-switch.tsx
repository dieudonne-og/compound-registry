import { Globe } from 'lucide-react';
import type { Language } from '@cr/contracts';
import { useI18n } from '@/i18n/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Language names are written in their own language, so anyone can find theirs. */
const NAMES: Record<Language, string> = { en: 'English', fr: 'Français' };

export function LanguageSwitch() {
  const { language, setLanguage, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('layout.language')} data-tour="language">
          <Globe />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={language} onValueChange={(v: string) => setLanguage(v as Language)}>
          {(Object.keys(NAMES) as Language[]).map((code) => (
            <DropdownMenuRadioItem key={code} value={code} lang={code}>
              {NAMES[code]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
