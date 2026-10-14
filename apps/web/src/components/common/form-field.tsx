import { useT } from '@/i18n/i18n';
import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

type Props = {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  /** Shown right after the label, e.g. an explanation button. */
  tip?: ReactNode;
  children: ReactNode;
};

/** Label, control, hint and error with ids wired for screen readers (`${htmlFor}-error`). */
export function FormField({ label, htmlFor, required, error, hint, tip, children }: Props) {
  const t = useT();
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Label htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="ml-0.5 text-destructive" aria-hidden>
              *
            </span>
          )}
        </Label>
        {tip}
      </div>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      <p id={`${htmlFor}-error`} className="text-sm text-destructive empty:hidden" aria-live="polite">
        {error && t(error)}
      </p>
    </div>
  );
}
