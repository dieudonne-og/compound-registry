import type { ReactNode } from 'react';
import { useT } from '@/i18n/i18n';
import { RequirePermission } from '@/features/auth/require-permission';

export function AdminGuard({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <RequirePermission action="admin:manage" message={t('admin.forbidden')}>
      {children}
    </RequirePermission>
  );
}
