import { useI18n } from '@/i18n/i18n';
import { useId, useRef, useState } from 'react';
import { FileText, ImageIcon, UploadCloud, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACCEPT, MAX_UPLOAD_MB, validateReportFile, type FileProblem } from '@/lib/files';
import { cn } from '@/lib/utils';

type Props = {
  file: File | null;
  onFile: (file: File | null) => void;
  error?: string;
  describedBy?: string;
  labelledBy?: string;
};

export function Dropzone({ file, onFile, error, describedBy, labelledBy }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { t, locale } = useI18n();
  const [localError, setLocalError] = useState<FileProblem | null>(null);
  const mb = (n: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(n);
  const hintId = useId();

  const pick = (f: File | undefined) => {
    if (!f) return;
    const problem = validateReportFile(f, MAX_UPLOAD_MB);
    setLocalError(problem);
    onFile(problem ? null : f);
  };
  const message = localError
    ? t(localError.key, localError.params && { size: mb(localError.params.size), max: localError.params.max })
    : error && t(error);

  if (file) {
    const Icon = file.type.startsWith('image/') ? ImageIcon : FileText;
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
        <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{file.name}</p>
          <p className="num text-xs text-muted-foreground">
            {t('upload.drop.size', { size: mb(file.size / 1024 / 1024) })}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onFile(null)}
          aria-label={t('upload.drop.remove')}
        >
          <X />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files[0]);
        }}
        aria-labelledby={labelledBy}
        aria-describedby={[hintId, describedBy].filter(Boolean).join(' ')}
        aria-invalid={!!message}
        className={cn(
          'flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-2 focus-visible:outline-ring',
          dragging ? 'border-primary bg-accent/50' : 'hover:border-primary/50 hover:bg-muted/40',
          message && 'border-destructive/50',
        )}
      >
        <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
          <UploadCloud className="size-6" />
        </span>
        <span className="font-medium">
          {t('upload.drop.prompt')}{' '}
          <span className="text-primary underline-offset-4 hover:underline">{t('upload.drop.browse')}</span>
        </span>
        <span id={hintId} className="text-sm text-muted-foreground">
          {t('upload.drop.hint', { max: MAX_UPLOAD_MB })}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {message && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
