const EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? 10);
export const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

/** A message key with its parameters; sizes are in MB and formatted by the screen for its locale. */
export type FileProblem = { key: string; params?: { size: number; max: number } };

export function validateReportFile(file: File, maxMb: number): FileProblem | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!EXTENSIONS.includes(ext)) return { key: 'upload.file.type' };
  if (file.size === 0) return { key: 'upload.file.empty' };
  if (file.size > maxMb * 1024 * 1024)
    return { key: 'upload.file.size', params: { size: file.size / 1024 / 1024, max: maxMb } };
  return null;
}
