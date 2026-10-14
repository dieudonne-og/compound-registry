import { Info } from 'lucide-react';
import { useT } from '@/i18n/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** A small “what is this?” button explaining the label it sits beside. */
export function InfoTip({ textKey }: { textKey: string }) {
  const t = useT();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={t('help.whatIsThis')}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm font-normal leading-relaxed" side="top">
        {t(textKey)}
      </PopoverContent>
    </Popover>
  );
}
