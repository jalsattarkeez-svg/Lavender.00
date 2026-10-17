import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCompletedSessions } from '@/lib/api';
import type { StudySessionWithNames, SessionType } from '@/types/database';
import { formatDuration, formatDateTime } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { Spinner, EmptyState, ErrorMessage } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { Badge, ProgressBar } from '@/components/ui/ConfirmDialog';
import { History, GraduationCap, ClipboardList, ChevronRight, Timer, AlertCircle, Coffee, TrendingUp } from 'lucide-react';

export function HistoryPage() {
  const t = useT();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<StudySessionWithNames[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<StudySessionWithNames | null>(null);

  const sessionTypeLabel = (type: SessionType): string => {
    const map: Record<SessionType, string> = {
      studying: t('study.typeStudying'),
      watching_lecture: t('study.typeWatching'),
      solving_questions: t('study.typeSolving'),
      reviewing: t('study.typeReviewing'),
      reading: t('study.typeReading'),
      other: t('study.typeOther'),
    };
    return map[type] ?? type;
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCompletedSessions(100, 0);
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={36} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-lavender-900">{t('history.title')}</h1>
        <p className="mt-1 text-sm text-lavender-500">{t('history.subtitle')}</p>
      </div>

      {error && <ErrorMessage message={error} />}

      {sessions.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={<History size={40} />}
            title={t('history.noSessions')}
            description={t('history.noSessionsDesc')}
            action={
              <button onClick={() => navigate('/study')} className="btn-primary">
                <Timer size={18} />
                {t('history.startStudy')}
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSession(s)}
              className="card group flex w-full items-center gap-4 p-4 text-start transition-all hover:shadow-md"
            >
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-lavender-100">
                <GraduationCap size={22} className="text-lavender-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-lavender-900">
                    {s.subject_name ?? '—'}
                  </p>
                  <Badge variant="default">{sessionTypeLabel(s.session_type)}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-lavender-500">
                  <span>{formatDateTime(s.ended_at ?? s.started_at)}</span>
                  {s.lesson_title && (
                    <span className="flex items-center gap-1">
                      <ClipboardList size={12} /> {s.lesson_title}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <ProgressBar value={s.focus_percentage} className="max-w-[120px]" />
                  <span className="text-xs text-lavender-500">{s.focus_percentage}% {t('study.focus')}</span>
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1 text-xs text-lavender-500">
                <span className="flex items-center gap-1 font-medium text-lavender-700">
                  <Timer size={14} /> {formatDuration(s.total_seconds)}
                </span>
                <span className="flex items-center gap-1 text-green-600">
                  {formatDuration(s.effective_seconds)}
                </span>
                {s.distraction_count > 0 && (
                  <span className="flex items-center gap-1 text-red-500">
                    <AlertCircle size={12} /> {s.distraction_count}
                  </span>
                )}
              </div>
              <ChevronRight size={18} className="flex-shrink-0 text-lavender-300 group-hover:text-lavender-500" />
            </button>
          ))}
        </div>
      )}

      <Modal open={!!selectedSession} onClose={() => setSelectedSession(null)} title={t('history.sessionDetails')} maxWidth="max-w-lg">
        {selectedSession && (
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <DetailRow label={t('history.date')} value={formatDateTime(selectedSession.started_at)} />
              <DetailRow label={t('history.type')} value={sessionTypeLabel(selectedSession.session_type)} />
              <DetailRow label={t('common.learningPath')} value={selectedSession.learning_path_name ?? '—'} />
              <DetailRow label={t('history.subject')} value={selectedSession.subject_name ?? '—'} />
              <DetailRow label={t('history.lesson')} value={selectedSession.lesson_title ?? '—'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DetailStat label={t('history.duration')} value={formatDuration(selectedSession.total_seconds)} icon={Timer} color="text-lavender-700" />
              <DetailStat label={t('history.effectiveTime')} value={formatDuration(selectedSession.effective_seconds)} icon={TrendingUp} color="text-green-600" />
              <DetailStat label={t('history.distractions')} value={formatDuration(selectedSession.distraction_seconds)} icon={AlertCircle} color="text-red-600" />
              <DetailStat label={t('study.break')} value={formatDuration(selectedSession.break_seconds)} icon={Coffee} color="text-amber-600" />
              <DetailStat label={t('study.focus')} value={`${selectedSession.focus_percentage}%`} icon={TrendingUp} color="text-lavender-600" />
              <DetailStat label={t('history.distractions')} value={String(selectedSession.distraction_count)} icon={AlertCircle} color="text-red-600" />
            </div>
            {selectedSession.note && (
              <div className="rounded-lg bg-lavender-50 p-3">
                <p className="text-xs font-medium text-lavender-500">{t('history.note')}</p>
                <p className="mt-1 text-sm text-lavender-700">{selectedSession.note}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-lavender-500">{label}</span>
      <span className="font-medium text-lavender-800">{value}</span>
    </div>
  );
}

function DetailStat({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof Timer; color: string }) {
  return (
    <div className="rounded-lg bg-lavender-50 p-3">
      <div className="flex items-center gap-1.5">
        <Icon size={14} className={color} />
        <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
      </div>
      <p className="text-xs text-lavender-500">{label}</p>
    </div>
  );
}
