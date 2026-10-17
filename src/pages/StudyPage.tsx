import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudyStore, type StudyState } from '@/store/study';
import { fetchSessionEvents, updateLessonStatus } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { SessionEvent, DistractionReason, Lesson } from '@/types/database';
import { formatDuration, elapsedSecondsSince } from '@/lib/format';
import { Spinner } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { StartStudyModal } from '@/components/study/StartStudyModal';
import {
  BookOpen,
  GraduationCap,
  ClipboardList,
  Play,
  AlertCircle,
  Coffee,
  Square,
  Phone,
  Smartphone,
  Cloud,
  Brain,
  Moon,
  Utensils,
  Users,
  FileQuestion,
  Meh,
  HelpCircle,
  CheckCircle2,
  CircleDot,
  Circle,
} from 'lucide-react';

const distractionReasons: { value: DistractionReason; label: string; icon: typeof Phone }[] = [
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'social_media', label: 'Social Media', icon: Smartphone },
  { value: 'daydreaming', label: 'Daydreaming', icon: Cloud },
  { value: 'tired', label: 'Tired', icon: Moon },
  { value: 'food_drink', label: 'Food / Drink', icon: Utensils },
  { value: 'interruption', label: 'Interruption', icon: Users },
  { value: 'difficult_material', label: 'Difficult Material', icon: FileQuestion },
  { value: 'boredom', label: 'Boredom', icon: Meh },
  { value: 'other', label: 'Other', icon: HelpCircle },
];

const sessionTypeLabels: Record<string, string> = {
  studying: 'Studying',
  watching_lecture: 'Watching Lecture',
  solving_questions: 'Solving Questions',
  reviewing: 'Reviewing',
  reading: 'Reading',
  other: 'Other',
};

interface StudyPageProps {
  startModalOpen: boolean;
  setStartModalOpen: (open: boolean) => void;
}

export function StudyPage({ startModalOpen, setStartModalOpen }: StudyPageProps) {
  const navigate = useNavigate();
  const {
    session,
    events,
    currentState,
    loading,
    init,
    startSession,
    transitionTo,
    endSession,
    cancelSession,
  } = useStudyStore();

  const [now, setNow] = useState(Date.now());
  const [showReasons, setShowReasons] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [sessionNote, setSessionNote] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [completedSession, setCompletedSession] = useState<Record<string, unknown> | null>(null);
  const [lessonInfo, setLessonInfo] = useState<Lesson | null>(null);
  const [allEvents, setAllEvents] = useState<SessionEvent[]>([]);

  useEffect(() => {
    init();
  }, [init]);

  // Tick every second for display
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [session]);

  // Load lesson info if session has a lesson
  useEffect(() => {
    if (session?.lesson_id) {
      (async () => {
        const { data, error } = await supabase
          .from('lessons')
          .select('*')
          .eq('id', session.lesson_id)
          .maybeSingle();
        if (!error && data) setLessonInfo(data as Lesson);
      })();
    } else {
      setLessonInfo(null);
    }
  }, [session?.lesson_id]);

  // Calculate live times from events
  const liveStats = (() => {
    if (!session) return { total: 0, effective: 0, distraction: 0, breakT: 0, distractionCount: 0 };

    let effective = 0;
    let distraction = 0;
    let breakT = 0;
    let distractionCount = 0;

    for (const ev of events) {
      if (ev.ended_at) {
        const dur = Math.max(0, Math.round((new Date(ev.ended_at).getTime() - new Date(ev.started_at).getTime()) / 1000));
        if (ev.event_type === 'study') effective += dur;
        else if (ev.event_type === 'distraction') { distraction += dur; distractionCount += 1; }
        else if (ev.event_type === 'break') breakT += dur;
      } else {
        // Open event — count from started_at to now
        const dur = Math.max(0, Math.round((now - new Date(ev.started_at).getTime()) / 1000));
        if (ev.event_type === 'study') effective += dur;
        else if (ev.event_type === 'distraction') { distraction += dur; distractionCount += 1; }
        else if (ev.event_type === 'break') breakT += dur;
      }
    }

    const total = Math.max(0, Math.round((now - new Date(session.started_at).getTime()) / 1000));
    const focusDenom = total - breakT;
    const focusPct = focusDenom > 0 ? Math.min(100, Math.max(0, Math.round((effective / focusDenom) * 100))) : 0;

    return { total, effective, distraction, breakT, distractionCount, focusPct };
  })();

  const handleStart = async (params: {
    learning_path_id: string | null;
    subject_id: string | null;
    lesson_id: string | null;
    session_type: import('@/types/database').SessionType;
  }) => {
    try {
      await startSession(params);
      setStartModalOpen(false);
    } catch {
      // error shown in store
    }
  };

  const handleDistracted = () => {
    setShowReasons(true);
  };

  const handleSelectReason = async (reason: DistractionReason | null) => {
    setShowReasons(false);
    try {
      await transitionTo('distraction', reason);
    } catch {
      // ignore
    }
  };

  const handleBreak = async () => {
    try {
      await transitionTo('break');
    } catch {
      // ignore
    }
  };

  const handleResumeStudy = async () => {
    try {
      await transitionTo('study');
    } catch {
      // ignore
    }
  };

  const handleEndSession = async () => {
    setShowEndConfirm(false);
    try {
      const completed = await endSession(sessionNote.trim() || null);
      if (completed) {
        const evs = await fetchSessionEvents(completed.id);
        setAllEvents(evs);
        setCompletedSession(completed as unknown as Record<string, unknown>);
        setShowSummary(true);
      }
      setSessionNote('');
    } catch {
      // ignore
    }
  };

  const handleCancelSession = async () => {
    await cancelSession();
    navigate('/dashboard');
  };

  const handleMarkLessonProgress = async (newStatus: 'in_progress' | 'completed') => {
    if (!session?.lesson_id) return;
    try {
      await updateLessonStatus(session.lesson_id, newStatus);
      setLessonInfo((prev) => prev ? { ...prev, status: newStatus } : null);
    } catch {
      // ignore
    }
  };

  // No active session
  if (!session) {
    return (
      <StartStudyModal
        open={startModalOpen}
        onClose={() => setStartModalOpen(false)}
        onStart={handleStart}
      />
    );
  }

  // Session summary view
  if (showSummary && completedSession) {
    return <SessionSummary
      session={completedSession}
      events={allEvents}
      onDone={() => {
        setShowSummary(false);
        setCompletedSession(null);
        navigate('/dashboard');
      }}
      onHistory={() => {
        setShowSummary(false);
        setCompletedSession(null);
        navigate('/history');
      }}
    />;
  }

  const stateConfig: Record<StudyState, { label: string; color: string; bg: string; icon: typeof Play }> = {
    study: { label: 'Studying', color: 'text-green-600', bg: 'bg-green-100', icon: Play },
    distraction: { label: 'Distracted', color: 'text-red-600', bg: 'bg-red-100', icon: AlertCircle },
    break: { label: 'On Break', color: 'text-amber-600', bg: 'bg-amber-100', icon: Coffee },
    idle: { label: 'Idle', color: 'text-lavender-400', bg: 'bg-lavender-100', icon: Circle },
  };

  const stateInfo = stateConfig[currentState] ?? stateConfig.idle;
  const StateIcon = stateInfo.icon;

  return (
    <div className="space-y-5">
      {/* Active session banner */}
      <div className={`flex items-center gap-3 rounded-xl p-4 ${stateInfo.bg}`}>
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${stateInfo.color} bg-white`}>
          <StateIcon size={22} />
        </div>
        <div>
          <p className={`text-sm font-semibold ${stateInfo.color}`}>{stateInfo.label}</p>
          <p className="text-xs text-lavender-500">{sessionTypeLabels[session.session_type] ?? session.session_type}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-bold tabular-nums text-lavender-900">{formatDuration(liveStats.total)}</p>
          <p className="text-xs text-lavender-400">Total time</p>
        </div>
      </div>

      {/* Session info */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {session.learning_path_id && (
            <span className="flex items-center gap-1.5 rounded-lg bg-lavender-50 px-3 py-1.5 text-lavender-600">
              <BookOpen size={14} /> Learning Path
            </span>
          )}
          {session.subject_id && (
            <span className="flex items-center gap-1.5 rounded-lg bg-lavender-50 px-3 py-1.5 text-lavender-600">
              <GraduationCap size={14} /> Subject
            </span>
          )}
          {session.lesson_id && lessonInfo && (
            <span className="flex items-center gap-1.5 rounded-lg bg-lavender-50 px-3 py-1.5 text-lavender-600">
              <ClipboardList size={14} /> {lessonInfo.title}
            </span>
          )}
        </div>
      </div>

      {/* Live stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Effective" value={formatDuration(liveStats.effective)} color="text-green-600" bg="bg-green-50" />
        <StatCard label="Distraction" value={formatDuration(liveStats.distraction)} color="text-red-600" bg="bg-red-50" />
        <StatCard label="Break" value={formatDuration(liveStats.breakT)} color="text-amber-600" bg="bg-amber-50" />
        <StatCard label="Focus" value={`${liveStats.focusPct ?? 0}%`} color="text-lavender-600" bg="bg-lavender-50" />
      </div>

      {/* Distraction count */}
      <div className="flex items-center justify-center gap-2 text-sm text-lavender-500">
        <AlertCircle size={16} />
        Distractions: <span className="font-semibold text-lavender-700">{liveStats.distractionCount}</span>
      </div>

      {/* Lesson progress controls */}
      {session.lesson_id && lessonInfo && (
        <div className="card p-4">
          <p className="mb-3 text-sm font-medium text-lavender-700">Lesson status</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleMarkLessonProgress('in_progress')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                lessonInfo.status === 'in_progress'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-lavender-50 text-lavender-500 hover:bg-lavender-100'
              }`}
            >
              <CircleDot size={16} /> Mark In Progress
            </button>
            <button
              onClick={() => handleMarkLessonProgress('completed')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                lessonInfo.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-lavender-50 text-lavender-500 hover:bg-lavender-100'
              }`}
            >
              <CheckCircle2 size={16} /> Mark Completed
            </button>
          </div>
        </div>
      )}

      {/* State controls */}
      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {currentState !== 'study' && (
            <button
              onClick={handleResumeStudy}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-green-700 active:scale-[0.98] disabled:opacity-50"
            >
              <Play size={18} /> Resume Study
            </button>
          )}
          {currentState !== 'distraction' && currentState !== 'break' && (
            <>
              <button
                onClick={handleDistracted}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-50"
              >
                <AlertCircle size={18} /> Distracted
              </button>
              <button
                onClick={handleBreak}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-amber-700 active:scale-[0.98] disabled:opacity-50"
              >
                <Coffee size={18} /> Take Break
              </button>
            </>
          )}
          {currentState === 'distraction' && (
            <div className="col-span-full flex items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              <AlertCircle size={18} /> Currently distracted — select a reason or resume
            </div>
          )}
          {currentState === 'break' && (
            <div className="col-span-full flex items-center justify-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-600">
              <Coffee size={18} /> On break — resume when ready
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setShowEndConfirm(true)}
            disabled={loading}
            className="btn-danger w-full"
          >
            <Square size={18} /> End Session
          </button>
          <button
            onClick={handleCancelSession}
            disabled={loading}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Distraction reason modal */}
      <Modal open={showReasons} onClose={() => setShowReasons(false)} title="What distracted you?" maxWidth="max-w-md">
        <div className="space-y-3">
          <p className="text-sm text-lavender-500">Optionally select a reason, or skip.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {distractionReasons.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.value}
                  onClick={() => handleSelectReason(r.value)}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-lavender-200 bg-white px-3 py-3 text-xs font-medium text-lavender-600 transition-all hover:border-lavender-300 hover:bg-lavender-50"
                >
                  <Icon size={20} />
                  {r.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => handleSelectReason(null)}
            className="btn-secondary w-full"
          >
            Skip reason
          </button>
        </div>
      </Modal>

      {/* End session confirmation */}
      <Modal open={showEndConfirm} onClose={() => setShowEndConfirm(false)} title="End study session?" maxWidth="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm text-lavender-600">Add an optional note about this session, then end it.</p>
          <textarea
            value={sessionNote}
            onChange={(e) => setSessionNote(e.target.value)}
            className="input-field min-h-[80px] resize-y"
            placeholder="Session notes (optional)..."
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowEndConfirm(false)} className="btn-secondary">
              Keep studying
            </button>
            <button onClick={handleEndSession} disabled={loading} className="btn-primary">
              {loading ? <Spinner size={18} /> : 'End session'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatCard({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div className={`rounded-xl p-4 ${bg}`}>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-lavender-500">{label}</p>
    </div>
  );
}

function SessionSummary({
  session,
  events,
  onDone,
  onHistory,
}: {
  session: Record<string, unknown>;
  events: SessionEvent[];
  onDone: () => void;
  onHistory: () => void;
}) {
  const total = session.total_seconds as number ?? 0;
  const effective = session.effective_seconds as number ?? 0;
  const distraction = session.distraction_seconds as number ?? 0;
  const breakT = session.break_seconds as number ?? 0;
  const focusPct = session.focus_percentage as number ?? 0;
  const distractionCount = session.distraction_count as number ?? 0;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 size={36} className="text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-lavender-900">Session Complete</h1>
        <p className="mt-1 text-sm text-lavender-500">Here's your study summary.</p>
      </div>

      <div className="card p-5">
        <div className="mb-4 space-y-2 text-sm">
          <SummaryRow label="Session type" value={sessionTypeLabels[session.session_type as string] ?? '—'} />
          <SummaryRow label="Subject" value={(session.subject_name as string) ?? '—'} />
          <SummaryRow label="Lesson" value={(session.lesson_title as string) ?? '—'} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SummaryStat label="Total time" value={formatDuration(total)} color="text-lavender-700" />
          <SummaryStat label="Effective" value={formatDuration(effective)} color="text-green-600" />
          <SummaryStat label="Distraction" value={formatDuration(distraction)} color="text-red-600" />
          <SummaryStat label="Break" value={formatDuration(breakT)} color="text-amber-600" />
          <SummaryStat label="Focus" value={`${focusPct}%`} color="text-lavender-600" />
          <SummaryStat label="Distractions" value={String(distractionCount)} color="text-red-600" />
        </div>
        {session.note != null && (
          <div className="mt-4 rounded-lg bg-lavender-50 p-3">
            <p className="text-xs font-medium text-lavender-500">Note</p>
            <p className="mt-1 text-sm text-lavender-700">{String(session.note)}</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={onDone} className="btn-secondary flex-1">Dashboard</button>
        <button onClick={onHistory} className="btn-primary flex-1">View History</button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-lavender-500">{label}</span>
      <span className="font-medium text-lavender-800">{value}</span>
    </div>
  );
}

function SummaryStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-lavender-50 p-3">
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-lavender-500">{label}</p>
    </div>
  );
}
