import { ApiError, csrfToken, getRequestLanguage, refreshSession, toApiError } from './api';

/** POSTs multipart data with upload progress (fetch cannot report upload progress). */
export function uploadWithProgress<T>(
  path: string,
  form: FormData,
  onProgress: (pct: number) => void,
  signal?: AbortSignal,
  retry = true,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api${path}`);
    xhr.withCredentials = true;
    xhr.responseType = 'json';
    xhr.setRequestHeader('x-csrf-token', csrfToken());
    xhr.setRequestHeader('accept-language', getRequestLanguage());
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.upload.onload = () => onProgress(100);
    xhr.onload = async () => {
      if (xhr.status === 401 && retry && (await refreshSession())) {
        uploadWithProgress<T>(path, form, onProgress, signal, false).then(resolve, reject);
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response as T);
      else reject(toApiError(xhr.status, xhr.response));
    };
    xhr.onerror = () =>
      reject(
        new ApiError(0, 'NETWORK_ERROR', 'The upload was interrupted. Check your connection and try again.'),
      );
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}
