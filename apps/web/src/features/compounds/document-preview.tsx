import { useEffect, useState } from 'react';
import { Minus, Plus, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DocumentPreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  // Created and revoked in the same effect so a remount never leaves a revoked URL behind.
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    // Syncing with an external browser resource, not deriving state: the URL must be created and revoked together.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  if (!url) return null;

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return (
      <iframe
        src={`${url}#toolbar=0&view=FitH`}
        title={`Preview of ${file.name}`}
        className="h-[70dvh] w-full rounded-lg border bg-muted"
      />
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
          aria-label="Zoom out"
        >
          <Minus />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => setZoom(1)}
          aria-label="Fit to width"
        >
          <Maximize />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
          aria-label="Zoom in"
        >
          <Plus />
        </Button>
      </div>
      <div className="h-[70dvh] overflow-auto rounded-lg border bg-muted">
        <img
          src={url}
          alt={`Uploaded report ${file.name}`}
          style={{ width: `${zoom * 100}%` }}
          className="max-w-none"
        />
      </div>
    </div>
  );
}
