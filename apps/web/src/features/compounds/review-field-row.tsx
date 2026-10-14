import { useT } from '@/i18n/i18n';
import { Check } from 'lucide-react';
import type { ExtractedField } from '@cr/contracts';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ConfidenceChip } from '@/components/common/confidence-chip';
import { cn } from '@/lib/utils';
import { valueError } from './review-state';

type Props = {
  field: ExtractedField;
  value: string;
  accepted: boolean;
  onChange: (value: string) => void;
  onAccept: (accepted: boolean) => void;
};

export function ReviewFieldRow({ field, value, accepted, onChange, onAccept }: Props) {
  const t = useT();
  const id = `field-${field.column}`;
  const error = valueError(value);
  const flagged = field.flags.some((f) => f !== 'missing_marker');
  return (
    <div
      className={cn(
        'grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-start',
        flagged
          ? cn('rounded-lg border p-3', !accepted && 'border-warning-border bg-warning-surface/60')
          : 'border-b py-3 last:border-b-0',
      )}
    >
      <div className="flex items-center gap-2 sm:pt-2">
        <label htmlFor={id} className="num font-medium">
          {field.label}
        </label>
      </div>
      <div className="space-y-1.5">
        <div className="relative">
          <Input
            id={id}
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('compounds.review.notReported')}
            aria-invalid={!!error}
            aria-describedby={`${id}-help`}
            className="num pr-8"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-muted-foreground">
            %
          </span>
        </div>
        <div id={`${id}-help`} className="space-y-1 text-xs">
          {error && <p className="text-destructive">{t(error)}</p>}
          {field.flags.map((f) => (
            <p key={f} className={cn(f === 'missing_marker' ? 'text-muted-foreground' : 'text-warning')}>
              {t(`compounds.review.flags.${f}`)}
            </p>
          ))}
          {field.candidates && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {field.candidates.map((c) => (
                <Button
                  key={c}
                  type="button"
                  size="sm"
                  variant={value === c ? 'default' : 'outline'}
                  className="num h-7"
                  onClick={() => onChange(c)}
                >
                  {value === c && <Check />} {c}
                </Button>
              ))}
            </div>
          )}
          {field.rawText && (
            <p className="num truncate text-muted-foreground" title={field.rawText}>
              {t('compounds.review.source', { text: field.rawText })}
              {field.uncertainty && ` · ±${field.uncertainty}`}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:pt-1.5">
        <ConfidenceChip value={field.confidence} />
        {flagged && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={accepted} onCheckedChange={(c) => onAccept(c === true)} />{' '}
            {t('compounds.review.looksCorrect')}
          </label>
        )}
      </div>
    </div>
  );
}
