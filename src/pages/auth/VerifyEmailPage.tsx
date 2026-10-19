import { useState, useRef, useEffect, type FormEvent, type ClipboardEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FlaskConical, ArrowRight, ArrowLeft, Mail } from 'lucide-react';
import { verifyOtp, resendSignupOtp } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';
import { Spinner } from '@/components/ui/Feedback';
import { useT } from '@/lib/i18n';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 30;

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const syncSession = useAuthStore((s) => s.syncSession);
  const t = useT();

  const [email, setEmail] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [verified, setVerified] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const stored = sessionStorage.getItem('lavender_pending_signup_email');
    if (stored) {
      setEmail(stored);
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const code = digits.join('');

  const setDigit = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length <= 1) {
      const next = [...digits];
      next[index] = clean;
      setDigits(next);
      if (clean && index < CODE_LENGTH - 1) {
        inputsRef.current[index + 1]?.focus();
      }
    } else if (clean.length > 1) {
      const chars = clean.slice(0, CODE_LENGTH).split('');
      const next = [...digits];
      for (let i = 0; i < chars.length && index + i < CODE_LENGTH; i++) {
        next[index + i] = chars[i];
      }
      setDigits(next);
      const lastIdx = Math.min(index + chars.length - 1, CODE_LENGTH - 1);
      inputsRef.current[lastIdx]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (pasted.length > 0) {
      const next = [...digits];
      for (let i = 0; i < pasted.length && i < CODE_LENGTH; i++) {
        next[i] = pasted[i];
      }
      setDigits(next);
      const lastIdx = Math.min(pasted.length - 1, CODE_LENGTH - 1);
      inputsRef.current[lastIdx]?.focus();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH || digits.some((d) => d === '')) {
      setError(t('auth.verifyCodePlaceholder'));
      return;
    }
    if (!email) {
      setError(t('common.error'));
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await verifyOtp(email, code);
      setVerified(true);
      setSuccess(t('auth.verifySuccess'));
      await syncSession();
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('auth.verifyFailed');
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
        setError(t('auth.verifyFailed'));
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending || !email) return;
    setError(null);
    setSuccess(null);
    setResending(true);
    try {
      await resendSignupOtp(email);
      setSuccess(t('auth.codeSent'));
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('frequent')) {
        setError(t('auth.resendTooSoon'));
        setCooldown(RESEND_COOLDOWN);
      } else {
        setError(msg);
      }
    } finally {
      setResending(false);
    }
  };

  const goBackToSignup = () => {
    sessionStorage.removeItem('lavender_pending_signup_email');
    navigate('/signup');
  };

  const cooldownLabel = t('auth.resendIn').replace('{seconds}', String(cooldown));

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-lavender-50 via-white to-lavender-100 px-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-lavender-600 shadow-lg shadow-lavender-600/30">
            <FlaskConical size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-lavender-900">Lavender Lab</h1>
          <p className="mt-1 text-sm text-lavender-500">{t('auth.startJourney')}</p>
        </div>

        <div className="card p-6">
          <div className="mb-5 flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-lavender-100">
              <Mail size={24} className="text-lavender-600" />
            </div>
            <h2 className="text-lg font-semibold text-lavender-900">{t('auth.verifyEmail')}</h2>
            {email && (
              <p className="text-sm text-lavender-500">
                {t('auth.verifyDesc')}
                <br />
                <span className="font-medium text-lavender-700">{email}</span>
              </p>
            )}
            {!email && (
              <p className="text-sm text-lavender-500">{t('auth.verifyDesc')}</p>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          {!email && !verified && (
            <div className="text-center">
              <p className="mb-4 text-sm text-lavender-500">{t('auth.changeEmail')}</p>
              <button onClick={goBackToSignup} className="btn-primary w-full">
                {t('auth.backToSignup')}
              </button>
            </div>
          )}

          {email && !verified && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-text sr-only" htmlFor="otp-0">
                  {t('auth.verifyCode')}
                </label>
                <div className="flex justify-center gap-2" dir="ltr">
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        inputsRef.current[index] = el;
                      }}
                      id={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      maxLength={1}
                      value={digit}
                      onChange={(e) => setDigit(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onPaste={handlePaste}
                      disabled={loading}
                      className="h-14 w-12 rounded-lg border-2 border-lavender-200 bg-white text-center text-xl font-bold text-lavender-900 focus:border-lavender-500 focus:outline-none focus:ring-2 focus:ring-lavender-500/20 disabled:opacity-50"
                    />
                  ))}
                </div>
              </div>
              <button type="submit" disabled={loading || code.length !== CODE_LENGTH} className="btn-primary w-full">
                {loading ? <Spinner size={18} /> : <>{t('auth.verify')} <ArrowRight size={18} /></>}
              </button>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={goBackToSignup}
                  className="flex items-center gap-1 text-sm text-lavender-500 hover:text-lavender-700"
                >
                  <ArrowLeft size={16} /> {t('auth.backToSignup')}
                </button>
                {cooldown > 0 ? (
                  <span className="text-sm text-lavender-400">{cooldownLabel}</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="flex items-center gap-1 text-sm font-medium text-lavender-600 hover:text-lavender-700 disabled:opacity-50"
                  >
                    {resending ? <Spinner size={14} /> : t('auth.resendCode')}
                  </button>
                )}
              </div>
            </form>
          )}

          {verified && (
            <div className="text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
              <p className="text-sm text-lavender-600">{t('auth.verifySuccess')}</p>
            </div>
          )}

          <p className="mt-5 text-center text-sm text-lavender-500">
            <Link to="/login" className="font-medium text-lavender-600 hover:text-lavender-700">
              {t('auth.haveAccount')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
