import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

type Props = {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
};

/** Label, control, hint and error with ids wired for screen readers (`${htmlFor}-error`). */
export function FormField({ label, htmlFor, required, error, hint, children }: Props) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      <p id={`${htmlFor}-error`} className="text-sm text-destructive empty:hidden" aria-live="polite">
        {error}
      </p>
    </div>
  );
}
