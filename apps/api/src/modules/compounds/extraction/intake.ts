import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import type { Params } from '@cr/contracts';
import { AppError } from '../../../shared/errors';

const ACCEPTED = {
  'application/pdf': { ext: 'pdf', names: ['pdf'] },
  'image/jpeg': { ext: 'jpg', names: ['jpg', 'jpeg'] },
  'image/png': { ext: 'png', names: ['png'] },
} as const;

export type AcceptedMime = keyof typeof ACCEPTED;

const unsupported = (message: string, params?: Params) =>
  new AppError('UNSUPPORTED_FILE_TYPE', 415, message, undefined, params);

/** Trusts the file content, not the browser's MIME type; the name must agree with the content. */
export async function inspectUpload(buffer: Buffer, filename: string) {
  const detected = await fileTypeFromBuffer(buffer);
  const accepted = detected && detected.mime in ACCEPTED ? ACCEPTED[detected.mime as AcceptedMime] : null;
  if (!detected || !accepted) throw unsupported('errors.UNSUPPORTED_FILE_TYPE');

  const nameExt = path.extname(filename).slice(1).toLowerCase();
  if (!(accepted.names as readonly string[]).includes(nameExt)) {
    throw unsupported('errors.fileMismatch', { kind: accepted.ext.toUpperCase(), ext: nameExt });
  }
  return { mime: detected.mime as AcceptedMime, ext: accepted.ext };
}
