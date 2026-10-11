/** Limits how many async tasks run at once; extra callers wait in order. */
export function createSemaphore(limit: number) {
  let active = 0;
  const waiting: (() => void)[] = [];

  const acquire = () =>
    active < limit ? (active++, Promise.resolve()) : new Promise<void>((resolve) => waiting.push(resolve));
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else active--;
  };

  return {
    async run<T>(task: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await task();
      } finally {
        release();
      }
    },
  };
}
export type Semaphore = ReturnType<typeof createSemaphore>;
