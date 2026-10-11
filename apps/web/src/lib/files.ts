const EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB ?? 10);
export const ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

export function validateReportFile(file: File, maxMb: number): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!EXTENSIONS.includes(ext)) return 'Upload a PDF, JPG, JPEG or PNG file.';
  if (file.size === 0) return 'This file is empty.';
  if (file.size > maxMb * 1024 * 1024)
    return `This file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The maximum is ${maxMb} MB.`;
  return null;
}
