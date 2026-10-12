import { useT } from '@/i18n/i18n';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function ConfidenceChip({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const t = useT();
  const tone = value >= 0.85 ? 'high' : value >= 0.6 ? 'medium' : 'low';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            'num inline-flex h-6 items-center gap-1.5 rounded-full px-2 text-xs font-medium ring-1 ring-inset',
            tone === 'high' && 'bg-success-surface text-success ring-success/25',
            tone === 'medium' && 'bg-warning-surface text-warning ring-warning-border',
            tone === 'low' && 'bg-danger-surface text-destructive ring-destructive/25',
          )}
        >
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
          {pct}%<span className="sr-only"> {t('common.confidence')}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{t('common.confidenceTip', { level: t(`common.levels.${tone}`) })}</TooltipContent>
    </Tooltip>
  );
}
