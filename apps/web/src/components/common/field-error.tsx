import { useT } from '@/i18n/i18n';

/** `message` may be a message key (from shared validation) or text already translated by the server. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  const t = useT();
  return (
    <p id={id} className="min-h-5 text-sm text-destructive" aria-live="polite">
      {message && t(message)}
    </p>
  );
}
