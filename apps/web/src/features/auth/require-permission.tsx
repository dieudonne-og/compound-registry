import type { ReactNode } from 'react';
import { ShieldOff } from 'lucide-react';
import type { Action } from '@cr/contracts';
import { useT } from '@/i18n/i18n';
import { EmptyState } from '@/components/common/empty-state';
import { useCan } from './session';

/**
 * Pages opened by URL that the user's role cannot use. The API refuses the action anyway;
 * this explains it up front instead of showing a form that fails on submit.
 */
export function RequirePermission({
  action,
  resource,
  message,
  children,
}: {
  action: Action;
  resource?: { createdBy: number };
  message?: string;
  children: ReactNode;
}) {
  const t = useT();
  const can = useCan();
  if (!can(action, resource)) return <EmptyState icon={ShieldOff} title={message ?? t('common.forbidden')} />;
  return children;
}
