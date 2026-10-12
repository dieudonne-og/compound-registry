import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const KEY = /^[0-9a-f-]{36}\.(pdf|jpg|png)$/;

export function createStorage(root: string) {
  const base = path.resolve(root);
  const resolve = (key: string) => {
    if (!KEY.test(key)) throw new Error('Invalid storage key');
    return path.join(base, key);
  };
  return {
    async save(buffer: Buffer, ext: 'pdf' | 'jpg' | 'png'): Promise<string> {
      await mkdir(base, { recursive: true, mode: 0o700 });
      const key = `${randomUUID()}.${ext}`;
      await writeFile(resolve(key), buffer, { mode: 0o600, flag: 'wx' });
      return key;
    },
    stream: (key: string) => createReadStream(resolve(key)),
    remove: async (key: string) => rm(resolve(key), { force: true }),
  };
}
export type Storage = ReturnType<typeof createStorage>;
