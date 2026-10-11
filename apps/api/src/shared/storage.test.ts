import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createStorage } from './storage';

const root = await mkdtemp(path.join(tmpdir(), 'storage-'));
afterAll(() => rm(root, { recursive: true, force: true }));

describe('storage', () => {
  const storage = createStorage(root);
  it('saves under a random, private name', async () => {
    const key = await storage.save(Buffer.from('data'), 'pdf');
    expect(key).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(await readFile(path.join(root, key), 'utf8')).toBe('data');
    expect((await stat(path.join(root, key))).mode & 0o777).toBe(0o600);
  });
  it('refuses keys that could escape the storage folder', () => {
    expect(() => storage.stream('../../etc/passwd')).toThrow(/Invalid storage key/);
  });
  it('removes files idempotently', async () => {
    const key = await storage.save(Buffer.from('x'), 'png');
    await storage.remove(key);
    await expect(storage.remove(key)).resolves.toBeUndefined();
  });
});
