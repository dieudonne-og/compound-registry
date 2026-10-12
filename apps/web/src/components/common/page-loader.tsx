import { useT } from '@/i18n/i18n';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PageLoader({ fullScreen = false }: { fullScreen?: boolean }) {
  const t = useT();
  return (
    <div
      className={cn('grid place-items-center', fullScreen ? 'min-h-dvh' : 'py-24')}
      role="status"
      aria-label={t('common.loading')}
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
