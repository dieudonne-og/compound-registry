import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: 'default' | 'warning' | 'danger';
  href?: string;
};

export function StatTile({ label, value, hint, icon: Icon, tone = 'default', href }: Props) {
  const body = (
    <div
      className={cn(
        'h-full rounded-xl border bg-card p-4 transition-colors sm:p-5',
        href && 'hover:border-primary/40',
        tone === 'warning' && 'border-warning-border',
        tone === 'danger' && 'border-destructive/40 bg-danger-surface',
      )}
    >
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        <Icon className="size-4" aria-hidden />
      </div>
      <p className="num mt-3 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? (
    <Link to={href} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-ring">
      {body}
    </Link>
  ) : (
    body
  );
}
