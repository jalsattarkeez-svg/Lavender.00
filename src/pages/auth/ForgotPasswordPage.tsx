import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FlaskConical, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { resetPassword } from '@/lib/auth';
import { Spinner } from '@/components/ui/Feedback';
import { useT } from '@/lib/i18n';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const t = useT();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
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
        </div>

        <div className="card p-6">
          {sent ? (
            <div className="flex flex-col items-center py-4 text-center">
              <CheckCircle size={48} className="mb-3 text-green-500" />
              <h2 className="mb-2 text-lg font-semibold text-lavender-900">{t('auth.checkEmail')}</h2>
              <p className="text-sm text-lavender-500">
                We've sent a password reset link to <span className="font-medium">{email}</span>.
                Follow the link to reset your password.
              </p>
              <Link to="/login" className="mt-5 btn-secondary">
                <ArrowLeft size={18} /> {t('auth.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              <h2 className="mb-2 text-lg font-semibold text-lavender-900">{t('auth.resetPassword')}</h2>
              <p className="mb-5 text-sm text-lavender-500">
                {t('auth.resetDesc')}
              </p>
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
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? <Spinner size={18} /> : t('auth.sendResetLink')}
                </button>
              </form>
              <Link to="/login" className="mt-5 flex items-center justify-center gap-1.5 text-sm font-medium text-lavender-500 hover:text-lavender-600">
                <ArrowLeft size={16} /> {t('auth.backToLogin')}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
