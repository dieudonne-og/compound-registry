import type { ReactNode } from 'react';
import { ShieldOff } from 'lucide-react';
import { useT } from '@/i18n/i18n';
import { EmptyState } from '@/components/common/empty-state';
import { useCan } from '@/features/auth/session';

/** The API refuses these screens to non-administrators anyway; this explains it instead of showing an error. */
export function AdminGuard({ children }: { children: ReactNode }) {
  const t = useT();
  const can = useCan();
  if (!can('admin:manage')) return <EmptyState icon={ShieldOff} title={t('admin.forbidden')} />;
  return children;
}
