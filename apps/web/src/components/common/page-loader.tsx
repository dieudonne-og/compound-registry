import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PageLoader({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      className={cn('grid place-items-center', fullScreen ? 'min-h-dvh' : 'py-24')}
      role="status"
      aria-label="Loading"
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
