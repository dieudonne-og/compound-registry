import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './api';

/** Copies server field errors onto the form. Returns true when at least one was applied. */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (!(error instanceof ApiError)) return false;
  const fields = { ...error.fieldErrors };
  const field = error.details?.field;
  if (typeof field === 'string') fields[field] = error.message;
  const entries = Object.entries(fields);
  entries.forEach(([name, message], i) =>
    setError(name as Path<T>, { type: 'server', message }, { shouldFocus: i === 0 }),
  );
  return entries.length > 0;
}
