import { useId, useRef, useState } from 'react';
import { FileText, ImageIcon, UploadCloud, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACCEPT, MAX_UPLOAD_MB, validateReportFile } from '@/lib/files';
import { cn } from '@/lib/utils';

type Props = { file: File | null; onFile: (file: File | null) => void; error?: string; describedBy?: string };

export function Dropzone({ file, onFile, error, describedBy }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const hintId = useId();

  const pick = (f: File | undefined) => {
    if (!f) return;
    const problem = validateReportFile(f, MAX_UPLOAD_MB);
    setLocalError(problem);
    onFile(problem ? null : f);
  };
  const message = localError ?? error;

  if (file) {
    const Icon = file.type.startsWith('image/') ? ImageIcon : FileText;
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
        <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{file.name}</p>
          <p className="num text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onFile(null)}
          aria-label="Remove file"
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
          Drop the lab report here, or{' '}
          <span className="text-primary underline-offset-4 hover:underline">browse</span>
        </span>
        <span id={hintId} className="text-sm text-muted-foreground">
          PDF, JPG, JPEG or PNG up to {MAX_UPLOAD_MB} MB. Scans and phone photos work.
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
