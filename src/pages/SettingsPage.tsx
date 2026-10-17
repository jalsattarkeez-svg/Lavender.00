import { useState, useEffect, type FormEvent } from 'react';
import { useAuthStore } from '@/store/auth';
import { updateProfile } from '@/lib/api';
import { useT, useI18n } from '@/lib/i18n';
import { Spinner, ErrorMessage } from '@/components/ui/Feedback';
import { User, Mail, Clock, Save, CheckCircle2, Globe } from 'lucide-react';

const timezones = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Toronto', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
  'Europe/Moscow', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai',
  'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney', 'Pacific/Auckland',
];

export function SettingsPage() {
  const t = useT();
  const { language, setLanguage } = useI18n();
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setAvatarUrl(profile.avatar_url ?? '');
      setTimezone(profile.timezone ?? 'UTC');
    }
  }, [profile]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateProfile({
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        timezone,
      });
      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={36} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-lavender-900">{t('settings.title')}</h1>
        <p className="mt-1 text-sm text-lavender-500">{t('settings.subtitle')}</p>
      </div>

      {/* Preferences section */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-lavender-900">{t('settings.preferences')}</h2>
        <div>
          <label className="label-text">{t('settings.language')}</label>
          <p className="mb-3 text-xs text-lavender-400">{t('settings.languageDesc')}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setLanguage('en')}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                language === 'en'
                  ? 'border-lavender-500 bg-lavender-50 text-lavender-800 ring-2 ring-lavender-500/20'
                  : 'border-lavender-200 bg-white text-lavender-600 hover:bg-lavender-50'
              }`}
            >
              <Globe size={18} />
              {t('settings.languageEn')}
            </button>
            <button
              onClick={() => setLanguage('ar')}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                language === 'ar'
                  ? 'border-lavender-500 bg-lavender-50 text-lavender-800 ring-2 ring-lavender-500/20'
                  : 'border-lavender-200 bg-white text-lavender-600 hover:bg-lavender-50'
              }`}
            >
              <Globe size={18} />
              {t('settings.languageAr')}
            </button>
          </div>
        </div>
      </div>

      {/* Profile section */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-lavender-900">{t('settings.profile')}</h2>

        {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <CheckCircle2 size={18} /> {t('settings.saved')}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label-text" htmlFor="displayName">{t('settings.displayName')}</label>
            <div className="relative">
              <User size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-lavender-300" />
              <input id="displayName" type="text" value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-field ps-10" placeholder={t('auth.displayNamePlaceholder')} />
            </div>
          </div>

          <div>
            <label className="label-text" htmlFor="email">{t('settings.email')}</label>
            <div className="relative">
              <Mail size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-lavender-300" />
              <input id="email" type="email" value={profile.email} disabled
                className="input-field ps-10 bg-lavender-50 text-lavender-400" />
            </div>
            <p className="mt-1 text-xs text-lavender-400">{t('settings.emailCannotChange')}</p>
          </div>

          <div>
            <label className="label-text" htmlFor="avatarUrl">
              {t('settings.avatarUrl')} <span className="text-lavender-300">{t('common.optional')}</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-lavender-200 text-sm font-semibold text-lavender-700">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  (displayName || profile.email).charAt(0).toUpperCase()
                )}
              </div>
              <input id="avatarUrl" type="url" value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="input-field" placeholder="https://example.com/avatar.jpg" />
            </div>
          </div>

          <div>
            <label className="label-text" htmlFor="timezone">{t('settings.timezone')}</label>
            <div className="relative">
              <Clock size={18} className="absolute start-3 top-1/2 -translate-y-1/2 text-lavender-300" />
              <select id="timezone" value={timezone}
                onChange={(e) => setTimezone(e.target.value)} className="input-field ps-10">
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Spinner size={18} /> : <><Save size={18} /> {t('settings.saveChanges')}</>}
            </button>
          </div>
        </form>
      </div>

      {/* Account info */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-lavender-900">{t('settings.account')}</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-lavender-500">{t('settings.memberSince')}</span>
            <span className="font-medium text-lavender-800">
              {new Date(profile.created_at).toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-lavender-500">{t('settings.userId')}</span>
            <span className="font-mono text-xs text-lavender-400">{profile.id.slice(0, 8)}...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
