import { useT } from '@/i18n/i18n';
import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageLoader } from '@/components/common/page-loader';
import { sessionKey, useSession } from './session';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading, mustChangePassword } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const t = useT();

  useEffect(() => {
    const onExpired = () => {
      client.setQueryData(sessionKey, null);
      toast.info(t('common.sessionEnded'));
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
    };
    window.addEventListener('session-expired', onExpired);
    return () => window.removeEventListener('session-expired', onExpired);
  }, [client, navigate, location, t]);

  if (isLoading) return <PageLoader fullScreen />;
  if (!user)
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  // A temporary password must be replaced before anything else, whichever link was opened.
  if (mustChangePassword && location.pathname !== '/change-password')
    return <Navigate to="/change-password" replace />;
  return children;
}
