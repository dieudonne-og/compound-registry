export function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <p id={id} className="min-h-5 text-sm text-destructive" aria-live="polite">
      {message}
    </p>
  );
}
