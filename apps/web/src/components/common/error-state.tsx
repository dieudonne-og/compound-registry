import { AlertTriangle, RotateCw } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const api = error instanceof ApiError ? error : null;
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-danger-surface px-6 py-12 text-center"
    >
      <AlertTriangle className="size-6 text-destructive" />
      <div className="space-y-1">
        <p className="font-medium">{api?.status === 404 ? 'Not found' : 'This could not be loaded'}</p>
        <p className="text-sm text-muted-foreground">
          {api?.message ?? 'Something went wrong. Please try again.'}
        </p>
        {api?.requestId && <p className="num text-xs text-muted-foreground">Reference {api.requestId}</p>}
      </div>
      {onRetry && api?.status !== 404 && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  );
}
