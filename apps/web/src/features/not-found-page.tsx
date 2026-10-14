import { useT } from '@/i18n/i18n';
import { Link } from 'react-router';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';

export function Component() {
  const t = useT();
  return (
    <EmptyState
      icon={Compass}
      title={t('notFoundPage.title')}
      description={t('notFoundPage.description')}
      action={
        <Button asChild variant="outline">
          <Link to="/">{t('notFoundPage.back')}</Link>
        </Button>
      }
    />
  );
}
