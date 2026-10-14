import { useMutation } from '@tanstack/react-query';
import type { ChangePasswordInput } from '@cr/contracts';
import { api } from '@/lib/api';

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordInput) =>
      api<void>('/auth/change-password', { method: 'POST', json: body }),
  });
}
