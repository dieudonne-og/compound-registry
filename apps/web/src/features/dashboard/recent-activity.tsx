import { Link } from 'react-router';
import { Pencil, PlusCircle } from 'lucide-react';
import type { DashboardSummary } from '@cr/contracts';
import { formatRelative } from '@/lib/format';
import { CRITICAL_LABELS } from '@/features/production/form-logic';

export function RecentActivity({ items }: { items: DashboardSummary['recentActivity'] }) {
  if (!items.length) return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ul className="divide-y">
      {items.map((a, i) => {
        const Icon = a.eventType === 'CREATE' ? PlusCircle : Pencil;
        return (
          <li key={i}>
            <Link
              to={`/production/${a.productionId}`}
              className="flex items-start gap-3 py-3 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1 text-sm">
                <p>
                  <span className="num font-medium">{a.productionCode}</span>{' '}
                  {a.eventType === 'CREATE'
                    ? 'registered'
                    : `— ${a.fields.map((f) => CRITICAL_LABELS[f as keyof typeof CRITICAL_LABELS]?.toLowerCase() ?? f).join(', ')} changed`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.actorLabel} · {formatRelative(a.occurredAt)}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
