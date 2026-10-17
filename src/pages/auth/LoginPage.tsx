import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FlaskConical, Mail, Lock, ArrowRight } from 'lucide-react';
import { signIn } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';
import { Spinner } from '@/components/ui/Feedback';
import { useT } from '@/lib/i18n';

export function LoginPage() {
  const navigate = useNavigate();
  const syncSession = useAuthStore((s) => s.syncSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      await syncSession();
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-lavender-50 via-white to-lavender-100 px-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-lavender-600 shadow-lg shadow-lavender-600/30">
            <FlaskConical size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-lavender-900">Lavender Lab</h1>
          <p className="mt-1 text-sm text-lavender-500">Track your real learning, not just desk time.</p>
        </div>

        <div className="card p-6">
          <h2 className="mb-5 text-lg font-semibold text-lavender-900">{t('auth.welcomeBack')}</h2>
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-text" htmlFor="email">{t('auth.email')}</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-lavender-300" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field pl-10"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label className="label-text" htmlFor="password">{t('auth.password')}</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-lavender-300" />
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <Spinner size={18} /> : <>{t('auth.signin')} <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link to="/signup" className="font-medium text-lavender-600 hover:text-lavender-700">
              {t('auth.createAccount')}
            </Link>
            <Link to="/forgot-password" className="font-medium text-lavender-500 hover:text-lavender-600">
              {t('auth.forgotPassword')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
