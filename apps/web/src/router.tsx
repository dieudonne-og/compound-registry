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
        handle: { crumb: 'crumbs.dashboard' },
        lazy: () => import('@/features/dashboard/dashboard-page'),
      },
      {
        path: 'compounds',
        handle: { crumb: 'crumbs.compounds' },
        children: [
          { index: true, lazy: () => import('@/features/compounds/compounds-page') },
          {
            path: 'upload',
            handle: { crumb: 'crumbs.upload' },
            lazy: () => import('@/features/compounds/upload-page'),
          },
          {
            path: ':id',
            handle: { crumb: 'crumbs.analysis' },
            lazy: () => import('@/features/compounds/compound-detail-page'),
          },
        ],
      },
      {
        path: 'production',
        handle: { crumb: 'crumbs.production' },
        children: [
          { index: true, lazy: () => import('@/features/production/production-list-page') },
          {
            path: 'new',
            handle: { crumb: 'crumbs.register' },
            lazy: () => import('@/features/production/production-form-page'),
          },
          {
            path: ':id',
            handle: { crumb: 'crumbs.record' },
            lazy: () => import('@/features/production/production-detail-page'),
          },
          {
            path: ':id/edit',
            handle: { crumb: 'crumbs.edit' },
            lazy: () => import('@/features/production/production-form-page'),
          },
        ],
      },
      { path: '*', lazy: () => import('@/features/not-found-page') },
    ],
  },
]);
