import { createBrowserRouter } from 'react-router';
import { AppShell } from '@/components/layout/app-shell';
import { RequireAuth } from '@/features/auth/require-auth';
import { PageLoader } from '@/components/common/page-loader';

export const router = createBrowserRouter([
  {
    path: '/login',
    hydrateFallbackElement: <PageLoader fullScreen />,
    lazy: () => import('@/features/auth/login-page'),
  },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    hydrateFallbackElement: <PageLoader fullScreen />,
    children: [
      {
        index: true,
        handle: { crumb: 'Dashboard' },
        lazy: () => import('@/features/dashboard/dashboard-page'),
      },
      {
        path: 'compounds',
        handle: { crumb: 'Compound analyses' },
        children: [
          { index: true, lazy: () => import('@/features/compounds/compounds-page') },
          {
            path: 'upload',
            handle: { crumb: 'Upload report' },
            lazy: () => import('@/features/compounds/upload-page'),
          },
          {
            path: ':id',
            handle: { crumb: 'Analysis' },
            lazy: () => import('@/features/compounds/compound-detail-page'),
          },
        ],
      },
      {
        path: 'production',
        handle: { crumb: 'Production' },
        children: [
          { index: true, lazy: () => import('@/features/production/production-list-page') },
          {
            path: 'new',
            handle: { crumb: 'Register' },
            lazy: () => import('@/features/production/production-form-page'),
          },
          {
            path: ':id',
            handle: { crumb: 'Record' },
            lazy: () => import('@/features/production/production-detail-page'),
          },
          {
            path: ':id/edit',
            handle: { crumb: 'Edit' },
            lazy: () => import('@/features/production/production-form-page'),
          },
        ],
      },
      { path: '*', lazy: () => import('@/features/not-found-page') },
    ],
  },
]);
