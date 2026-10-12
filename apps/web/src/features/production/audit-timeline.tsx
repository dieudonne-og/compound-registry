import { ArrowRight, Pencil, PlusCircle } from 'lucide-react';
import type { AuditEventView } from '@cr/contracts';
import { formatDateTime, shortHash } from '@/lib/format';
import { CRITICAL_LABELS } from './form-logic';

export function AuditTimeline({ events }: { events: AuditEventView[] }) {
  return (
    <ol className="relative space-y-6 before:absolute before:inset-y-2 before:left-[15px] before:w-px before:bg-border">
      {[...events].reverse().map((e) => {
        const Icon = e.eventType === 'CREATE' ? PlusCircle : Pencil;
        return (
          <li key={e.seq} className="relative grid grid-cols-[2rem_1fr] gap-3">
            <span className="z-10 grid size-8 place-items-center rounded-full border bg-card text-primary">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="font-medium">
                  {e.eventType === 'CREATE'
                    ? 'Registered'
                    : `Changed ${e.changes.map((c) => CRITICAL_LABELS[c.field].toLowerCase()).join(', ')}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {e.actor.label} · <time dateTime={e.occurredAt}>{formatDateTime(e.occurredAt)}</time>
                </p>
              </div>
              {e.reason && (
                <blockquote className="border-l-2 pl-3 text-sm italic text-muted-foreground">
                  “{e.reason}”
                </blockquote>
              )}
              <ul className="space-y-1 text-sm">
                {e.changes.map((c) => (
                  <li key={c.field} className="flex flex-wrap items-center gap-2">
                    <span className="w-36 text-muted-foreground">{CRITICAL_LABELS[c.field]}</span>
                    {c.fromLabel !== null && (
                      <>
                        <span className="num text-muted-foreground line-through">{c.fromLabel}</span>
                        <ArrowRight className="size-3.5 text-muted-foreground" aria-label="changed to" />
                      </>
                    )}
                    <span className="num font-medium">{c.toLabel}</span>
                  </li>
                ))}
              </ul>
              <p
                className="num text-xs text-muted-foreground"
                title={`hash ${e.hash}\nprevious ${e.prevHash}`}
              >
                #{e.seq} · {shortHash(e.hash)} ← {shortHash(e.prevHash)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
