import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageLoader } from '@/components/common/page-loader';
import { sessionKey, useSession } from './session';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();

  useEffect(() => {
    const onExpired = () => {
      client.setQueryData(sessionKey, null);
      toast.info('Your session ended. Please sign in again.');
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
    };
    window.addEventListener('session-expired', onExpired);
    return () => window.removeEventListener('session-expired', onExpired);
  }, [client, navigate, location]);

  if (isLoading) return <PageLoader fullScreen />;
  if (!user)
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}
