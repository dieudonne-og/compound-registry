import { useT } from '@/i18n/i18n';
import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const STAGES = ['upload.stages.upload', 'upload.stages.read', 'upload.stages.ocr', 'upload.stages.match'];

/**
 * Upload progress is measured; the processing stages that follow happen on the server in one request,
 * so they advance on a timer and all complete when the response arrives.
 */
export function ProcessingStages({ uploadPct }: { uploadPct: number }) {
  const t = useT();
  const uploaded = uploadPct >= 100;
  const [serverStage, setServerStage] = useState(1);
  useEffect(() => {
    if (!uploaded) return;
    const timers = [setTimeout(() => setServerStage(2), 1500), setTimeout(() => setServerStage(3), 6000)];
    return () => timers.forEach(clearTimeout);
  }, [uploaded]);
  const stage = uploaded ? serverStage : 0;

  return (
    <div className="space-y-6 rounded-xl border bg-card p-6" role="status" aria-live="polite">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium">{t(STAGES[stage]!)}…</span>
          {stage === 0 && <span className="num">{uploadPct}%</span>}
        </div>
        <Progress
          value={stage === 0 ? uploadPct : undefined}
          className={cn(stage > 0 && '[&>div]:animate-pulse')}
          aria-label={t('upload.stages.progress')}
        />
      </div>
      <ol className="space-y-3">
        {STAGES.map((label, i) => (
          <li
            key={label}
            className={cn('flex items-center gap-3 text-sm', i > stage && 'text-muted-foreground')}
          >
            <span
              className={cn(
                'grid size-6 place-items-center rounded-full border',
                i < stage && 'border-primary bg-primary text-primary-foreground',
                i === stage && 'border-primary text-primary',
              )}
            >
              {i < stage ? (
                <Check className="size-3.5" />
              ) : i === stage ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <span className="num text-xs">{i + 1}</span>
              )}
            </span>
            {t(label)}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">{t('upload.stages.note')}</p>
    </div>
  );
}
