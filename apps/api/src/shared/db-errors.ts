type DbError = { code?: string; sqlMessage?: string; message?: string; cause?: unknown };

/** Drizzle may wrap driver errors; look through `cause`. */
function driverError(err: unknown): DbError {
  const e = err as DbError;
  return e?.code ? e : ((e?.cause as DbError) ?? e ?? {});
}

export const dbErrorCode = (err: unknown) => driverError(err).code;

export function isDuplicate(err: unknown, keyName: string): boolean {
  const e = driverError(err);
  return e.code === 'ER_DUP_ENTRY' && `${e.sqlMessage ?? e.message ?? ''}`.includes(keyName);
}
