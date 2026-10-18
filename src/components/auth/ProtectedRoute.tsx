import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { FullPageSpinner } from '@/components/ui/Feedback';
import { useT } from '@/lib/i18n';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const session = useAuthStore((s) => s.session);
  const initializing = useAuthStore((s) => s.initializing);
  const t = useT();

  if (initializing) {
    return <FullPageSpinner message={t('common.loading')} />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
