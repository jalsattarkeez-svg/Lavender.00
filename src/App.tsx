import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { LearningPage } from '@/pages/LearningPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { StudyPage } from '@/pages/StudyPage';
import { HistoryPage } from '@/pages/HistoryPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { GoalsPage } from '@/pages/GoalsPage';
import { ExamsDeadlinesPage } from '@/pages/ExamsDeadlinesPage';
import { DailyPlanPage } from '@/pages/DailyPlanPage';
import { WeeklyPlannerPage } from '@/pages/WeeklyPlannerPage';
import { RevisionPage } from '@/pages/RevisionPage';
import { MistakeLogPage } from '@/pages/MistakeLogPage';

function AppRoutes() {
  const init = useAuthStore((s) => s.init);
  const session = useAuthStore((s) => s.session);
  const initializing = useAuthStore((s) => s.initializing);
  const [startModalOpen, setStartModalOpen] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  if (initializing) {
    return null;
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/signup" element={session ? <Navigate to="/dashboard" /> : <SignupPage />} />
      <Route path="/verify-email" element={session ? <Navigate to="/dashboard" /> : <VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/learning"
        element={
          <ProtectedRoute>
            <AppLayout>
              <LearningPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/study"
        element={
          <ProtectedRoute>
            <AppLayout>
              <StudyPage startModalOpen={startModalOpen} setStartModalOpen={setStartModalOpen} />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <AppLayout>
              <HistoryPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AnalyticsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/goals"
        element={
          <ProtectedRoute>
            <AppLayout>
              <GoalsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/exams"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ExamsDeadlinesPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/plan"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DailyPlanPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/planner"
        element={
          <ProtectedRoute>
            <AppLayout>
              <WeeklyPlannerPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/revision"
        element={
          <ProtectedRoute>
            <AppLayout>
              <RevisionPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/mistakes"
        element={
          <ProtectedRoute>
            <AppLayout>
              <MistakeLogPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SettingsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to={session ? '/dashboard' : '/login'} />} />
      <Route path="*" element={<Navigate to={session ? '/dashboard' : '/login'} />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
