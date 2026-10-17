import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAnalytics, type AnalyticsData, type AnalyticsRange } from '@/lib/api';
import { formatDuration, formatDurationShort, formatDate } from '@/lib/format';
import { Spinner, EmptyState, ErrorMessage } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar, Badge } from '@/components/ui/ConfirmDialog';
import type { StudySessionWithNames, DistractionReason } from '@/types/database';
import {
  BarChart3,
  Clock,
  Timer,
  AlertCircle,
  Coffee,
  Focus,
  TrendingUp,
  GraduationCap,
  Phone,
  Smartphone,
  Cloud,
  Moon,
  Utensils,
  Users,
  FileQuestion,
  Meh,
  HelpCircle,
  ChevronRight,
  Calendar,
} from 'lucide-react';

const rangeOptions: { value: AnalyticsRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
];

const reasonLabels: Record<DistractionReason, { label: string; icon: typeof Phone }> = {
  phone: { label: 'Phone', icon: Phone },
  social_media: { label: 'Social Media', icon: Smartphone },
  daydreaming: { label: 'Daydreaming', icon: Cloud },
  tired: { label: 'Tired', icon: Moon },
  food_drink: { label: 'Food / Drink', icon: Utensils },
  interruption: { label: 'Interruption', icon: Users },
  difficult_material: { label: 'Difficult Material', icon: FileQuestion },
  boredom: { label: 'Boredom', icon: Meh },
  other: { label: 'Other', icon: HelpCircle },
};

const sessionTypeLabels: Record<string, string> = {
  studying: 'Studying',
  watching_lecture: 'Watching Lecture',
  solving_questions: 'Solving Questions',
  reviewing: 'Reviewing',
  reading: 'Reading',
  other: 'Other',
};

export function AnalyticsPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState<AnalyticsRange>('7d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<StudySessionWithNames | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAnalytics(range)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [range]);

  const hasData = data && data.overview.totalSeconds > 0;

  const maxDailySeconds = useMemo(() => {
    if (!data || data.daily.length === 0) return 1;
    return Math.max(1, ...data.daily.map((d) => d.effectiveSeconds));
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={36} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-lavender-900">Analytics</h1>
          <p className="mt-1 text-sm text-lavender-500">Insights from your study sessions.</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-lavender-200 bg-white p-1">
          {rangeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                range === opt.value
                  ? 'bg-lavender-600 text-white'
                  : 'text-lavender-500 hover:bg-lavender-50 hover:text-lavender-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {!hasData ? (
        <div className="card p-6">
          <EmptyState
            icon={<BarChart3 size={40} />}
            title="No study data for this period"
            description="Start a study session to see your analytics here."
            action={
              <button onClick={() => navigate('/study')} className="btn-primary">
                <Timer size={18} />
                Start studying
              </button>
            }
          />
        </div>
      ) : (
        <>
          {/* Overview cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <OverviewCard
              label="Effective Study Time"
              value={formatDuration(data!.overview.effectiveSeconds)}
              icon={TrendingUp}
              color="text-green-600"
              bg="bg-green-50"
            />
            <OverviewCard
              label="Total Study Time"
              value={formatDuration(data!.overview.totalSeconds)}
              icon={Clock}
              color="text-lavender-600"
              bg="bg-lavender-50"
            />
            <OverviewCard
              label="Distraction Time"
              value={formatDuration(data!.overview.distractionSeconds)}
              icon={AlertCircle}
              color="text-red-600"
              bg="bg-red-50"
            />
            <OverviewCard
              label="Break Time"
              value={formatDuration(data!.overview.breakSeconds)}
              icon={Coffee}
              color="text-amber-600"
              bg="bg-amber-50"
            />
            <OverviewCard
              label="Focus"
              value={`${data!.overview.focusPercentage}%`}
              icon={Focus}
              color="text-lavender-600"
              bg="bg-lavender-50"
            />
            <OverviewCard
              label="Completed Sessions"
              value={String(data!.overview.completedSessions)}
              icon={Calendar}
              color="text-lavender-600"
              bg="bg-lavender-50"
            />
            <OverviewCard
              label="Distractions"
              value={String(data!.overview.distractionCount)}
              icon={AlertCircle}
              color="text-red-600"
              bg="bg-red-50"
            />
          </div>

          {/* Focus bar */}
          <div className="card flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-lavender-100">
              <Focus size={24} className="text-lavender-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-lavender-500">Overall focus percentage</p>
              <div className="mt-2 flex items-center gap-3">
                <ProgressBar value={data!.overview.focusPercentage} className="flex-1" />
                <span className="text-lg font-bold text-lavender-900">
                  {data!.overview.focusPercentage}%
                </span>
              </div>
            </div>
          </div>

          {/* Daily chart */}
          {data!.daily.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-4 text-lg font-semibold text-lavender-900">
                Effective Study Time
              </h2>
              <div className="flex items-end gap-1 overflow-x-auto" style={{ minHeight: '160px' }}>
                {data!.daily.map((entry) => {
                  const heightPct = (entry.effectiveSeconds / maxDailySeconds) * 100;
                  const hasTime = entry.effectiveSeconds > 0;
                  return (
                    <div
                      key={entry.date}
                      className="group relative flex min-w-[36px] flex-1 flex-col items-center gap-1"
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-lavender-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {formatDurationShort(entry.effectiveSeconds)}
                      </span>
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className={`w-full rounded-t-md transition-all ${
                            hasTime
                              ? 'bg-lavender-500 group-hover:bg-lavender-600'
                              : 'bg-lavender-100'
                          }`}
                          style={{ height: `${Math.max(hasTime ? 4 : 2, heightPct)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-lavender-400">
                        {range === 'today'
                          ? 'Today'
                          : new Date(entry.date).toLocaleDateString(undefined, {
                              month: 'numeric',
                              day: 'numeric',
                            })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Effective vs Distraction vs Break */}
          <div className="card p-5">
            <h2 className="mb-4 text-lg font-semibold text-lavender-900">
              Time Breakdown
            </h2>
            <TimeBreakdownBar
              effective={data!.overview.effectiveSeconds}
              distraction={data!.overview.distractionSeconds}
              breakTime={data!.overview.breakSeconds}
            />
            <div className="mt-4 grid grid-cols-3 gap-3">
              <BreakdownLegend
                label="Effective"
                value={formatDuration(data!.overview.effectiveSeconds)}
                color="bg-green-500"
              />
              <BreakdownLegend
                label="Distraction"
                value={formatDuration(data!.overview.distractionSeconds)}
                color="bg-red-500"
              />
              <BreakdownLegend
                label="Break"
                value={formatDuration(data!.overview.breakSeconds)}
                color="bg-amber-500"
              />
            </div>
          </div>

          {/* Subject analytics */}
          {data!.subjects.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-4 text-lg font-semibold text-lavender-900">
                Subject Analytics
              </h2>
              <div className="space-y-3">
                {data!.subjects.map((subject) => (
                  <div
                    key={subject.subjectId}
                    className="flex items-center gap-4 rounded-lg border border-lavender-50 p-3 transition-colors hover:border-lavender-200 hover:bg-lavender-50/50"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-lavender-100">
                      <GraduationCap size={20} className="text-lavender-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-lavender-900">
                        {subject.subjectName}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <ProgressBar value={subject.focusPercentage} className="max-w-[160px]" />
                        <span className="text-xs text-lavender-500">
                          {subject.focusPercentage}% focus
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1 text-xs text-lavender-500">
                      <span className="font-medium text-green-600">
                        {formatDuration(subject.effectiveSeconds)}
                      </span>
                      <span>{subject.sessionCount} sessions</span>
                      {subject.distractionSeconds > 0 && (
                        <span className="text-red-500">
                          {formatDuration(subject.distractionSeconds)} distracted
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Distraction reasons */}
          {data!.distractionReasons.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-4 text-lg font-semibold text-lavender-900">
                Distraction Reasons
              </h2>
              <div className="space-y-2">
                {data!.distractionReasons.map((entry) => {
                  const config = reasonLabels[entry.reason] ?? reasonLabels.other;
                  const Icon = config.icon;
                  return (
                    <div
                      key={entry.reason}
                      className="flex items-center gap-3 rounded-lg border border-lavender-50 p-3"
                    >
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-red-50">
                        <Icon size={18} className="text-red-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-lavender-900">{config.label}</p>
                        <p className="text-xs text-lavender-500">
                          {entry.count} time{entry.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <Badge variant="default">{formatDurationShort(entry.totalSeconds)}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent sessions */}
          {data!.sessions.length > 0 && (
            <div className="card p-5">
              <h2 className="mb-4 text-lg font-semibold text-lavender-900">
                Sessions in This Period
              </h2>
              <div className="space-y-2">
                {data!.sessions.slice().reverse().map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSession(s)}
                    className="group flex w-full items-center gap-3 rounded-lg border border-lavender-50 p-3 text-left transition-all hover:border-lavender-200 hover:bg-lavender-50/50"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-lavender-100">
                      <Timer size={18} className="text-lavender-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-lavender-900">
                        {s.subject_name ?? 'General'}
                      </p>
                      <p className="text-xs text-lavender-500">
                        {formatDate(s.started_at)}
                        {s.lesson_title ? ` · ${s.lesson_title}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3 text-xs">
                      <span className="font-medium text-green-600">
                        {formatDuration(s.effective_seconds)}
                      </span>
                      <Badge variant={s.status === 'active' ? 'info' : 'default'}>
                        {s.status === 'active' ? 'Active' : sessionTypeLabels[s.session_type] ?? s.session_type}
                      </Badge>
                      <ChevronRight
                        size={16}
                        className="text-lavender-300 group-hover:text-lavender-500"
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Session detail modal */}
      <Modal
        open={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        title="Session Details"
        maxWidth="max-w-lg"
      >
        {selectedSession && (
          <div className="space-y-4">
            <div className="space-y-2 text-sm">
              <DetailRow label="Date" value={formatDate(selectedSession.started_at)} />
              <DetailRow
                label="Session type"
                value={sessionTypeLabels[selectedSession.session_type] ?? selectedSession.session_type}
              />
              <DetailRow label="Learning path" value={selectedSession.learning_path_name ?? '—'} />
              <DetailRow label="Subject" value={selectedSession.subject_name ?? '—'} />
              <DetailRow label="Lesson" value={selectedSession.lesson_title ?? '—'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DetailStat label="Total time" value={formatDuration(selectedSession.total_seconds)} color="text-lavender-700" />
              <DetailStat label="Effective" value={formatDuration(selectedSession.effective_seconds)} color="text-green-600" />
              <DetailStat label="Distraction" value={formatDuration(selectedSession.distraction_seconds)} color="text-red-600" />
              <DetailStat label="Break" value={formatDuration(selectedSession.break_seconds)} color="text-amber-600" />
              <DetailStat label="Focus" value={`${selectedSession.focus_percentage}%`} color="text-lavender-600" />
              <DetailStat label="Distractions" value={String(selectedSession.distraction_count)} color="text-red-600" />
            </div>
            {selectedSession.note && (
              <div className="rounded-lg bg-lavender-50 p-3">
                <p className="text-xs font-medium text-lavender-500">Note</p>
                <p className="mt-1 text-sm text-lavender-700">{selectedSession.note}</p>
              </div>
            )}
            <button
              onClick={() => {
                setSelectedSession(null);
                navigate('/history');
              }}
              className="btn-secondary w-full"
            >
              View in History
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

function OverviewCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: string;
  icon: typeof Clock;
  color: string;
  bg: string;
}) {
  return (
    <div className="card p-4">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${bg}`}>
        <Icon size={20} className={color} />
      </div>
      <p className="text-xl font-bold tabular-nums text-lavender-900">{value}</p>
      <p className="text-sm text-lavender-500">{label}</p>
    </div>
  );
}

function TimeBreakdownBar({
  effective,
  distraction,
  breakTime,
}: {
  effective: number;
  distraction: number;
  breakTime: number;
}) {
  const total = effective + distraction + breakTime;
  if (total === 0) return null;
  const effPct = (effective / total) * 100;
  const distractPct = (distraction / total) * 100;
  const breakPct = (breakTime / total) * 100;

  return (
    <div className="flex h-8 w-full overflow-hidden rounded-lg">
      <div className="bg-green-500 transition-all" style={{ width: `${effPct}%` }} />
      <div className="bg-red-500 transition-all" style={{ width: `${distractPct}%` }} />
      <div className="bg-amber-500 transition-all" style={{ width: `${breakPct}%` }} />
    </div>
  );
}

function BreakdownLegend({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-3 w-3 rounded ${color}`} />
      <div>
        <p className="text-xs text-lavender-500">{label}</p>
        <p className="text-sm font-medium text-lavender-800">{value}</p>
      </div>
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

function DetailStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-lavender-50 p-3">
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-xs text-lavender-500">{label}</p>
    </div>
  );
}
