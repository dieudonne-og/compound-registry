import { describe, expect, it } from 'vitest';
import { createSemaphore } from './semaphore';

describe('createSemaphore', () => {
  it('never runs more tasks at once than allowed, and runs them all', async () => {
    const limit = createSemaphore(2);
    let running = 0;
    let peak = 0;
    const task = async (i: number) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return i;
    };
    const results = await Promise.all([1, 2, 3, 4, 5].map((i) => limit.run(() => task(i))));
    expect(results).toEqual([1, 2, 3, 4, 5]);
    expect(peak).toBe(2);
  });

  it('releases its slot when a task fails', async () => {
    const limit = createSemaphore(1);
    await expect(limit.run(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(limit.run(async () => 'next')).resolves.toBe('next');
  });
});
