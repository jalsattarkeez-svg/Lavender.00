import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  GraduationCap,
  ClipboardList,
  CheckCircle2,
  TrendingUp,
  Timer,
  ArrowRight,
  Sparkles,
  Clock,
  Target,
  AlertCircle,
  Focus,
  CalendarClock,
  FileText,
  ListChecks,
  RotateCcw,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { useStudyStore } from '@/store/study';
import { useT } from '@/lib/i18n';
import {
  fetchDashboardStats, fetchAllSubjects, fetchTodayStudyStats,
  fetchActiveGoalsForDashboard, fetchDashboardUpcoming,
  fetchDashboardTasksSummary, type DashboardStats, type DashboardTasksSummary,
} from '@/lib/api';
import type { SubjectWithProgress, TodayStudyStats, GoalWithProgress, ExamWithNames, DeadlineWithNames } from '@/types/database';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import { ProgressBar, Badge } from '@/components/ui/ConfirmDialog';
import { StartStudyModal } from '@/components/study/StartStudyModal';
import { formatDuration } from '@/lib/format';
import { updateStudyTask } from '@/lib/api';

export function DashboardPage() {
  const t = useT();
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const studyInit = useStudyStore((s) => s.init);
  const activeSession = useStudyStore((s) => s.session);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [subjects, setSubjects] = useState<SubjectWithProgress[]>([]);
  const [studyStats, setStudyStats] = useState<TodayStudyStats | null>(null);
  const [activeGoals, setActiveGoals] = useState<GoalWithProgress[]>([]);
  const [upcoming, setUpcoming] = useState<{ nextExam: ExamWithNames | null; nextDeadline: DeadlineWithNames | null }>({ nextExam: null, nextDeadline: null });
  const [taskSummary, setTaskSummary] = useState<DashboardTasksSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [startModalOpen, setStartModalOpen] = useState(false);

  const displayName = profile?.display_name || profile?.email?.split('@')[0] || 'there';

  useEffect(() => {
    studyInit();
    (async () => {
      try {
        const [s, subs, study, goals, upc, tasks] = await Promise.all([
          fetchDashboardStats(),
          fetchAllSubjects(),
          fetchTodayStudyStats(),
          fetchActiveGoalsForDashboard(3),
          fetchDashboardUpcoming(),
          fetchDashboardTasksSummary().catch(() => null),
        ]);
        setStats(s);
        setSubjects(subs);
        setStudyStats(study);
        setActiveGoals(goals);
        setUpcoming(upc);
        setTaskSummary(tasks);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [studyInit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={36} />
      </div>
    );
  }

  const recentSubjects = subjects.slice(0, 5);

  const handleStartStudy = () => {
    if (activeSession) {
      navigate('/study');
    } else {
      setStartModalOpen(true);
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    try {
      await updateStudyTask(taskId, { status: currentStatus === 'completed' ? 'pending' : 'completed' });
      const fresh = await fetchDashboardTasksSummary().catch(() => null);
      if (fresh) setTaskSummary(fresh);
    } catch {
      // ignore
    }
  };

  const statCards = [
    { label: t('learning.paths'), value: stats?.learningPathCount ?? 0, icon: BookOpen, color: 'text-lavender-600', bg: 'bg-lavender-100' },
    { label: t('learning.subjects'), value: stats?.subjectCount ?? 0, icon: GraduationCap, color: 'text-lavender-600', bg: 'bg-lavender-100' },
    { label: t('learning.lessons'), value: stats?.lessonCount ?? 0, icon: ClipboardList, color: 'text-lavender-600', bg: 'bg-lavender-100' },
    { label: t('learning.completed'), value: stats?.completedLessonCount ?? 0, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100' },
  ];

  const studyStatCards = [
    { label: t('study.effective'), value: formatDuration(studyStats?.todayEffectiveSeconds ?? 0), icon: Clock, color: 'text-green-600', bg: 'bg-green-50' },
    { label: t('study.totalTime'), value: formatDuration(studyStats?.todayTotalSeconds ?? 0), icon: Timer, color: 'text-lavender-600', bg: 'bg-lavender-50' },
    { label: t('study.distraction'), value: formatDuration(studyStats?.todayDistractionSeconds ?? 0), icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
    { label: t('dashboard.sessions'), value: String(studyStats?.completedSessionsToday ?? 0), icon: Target, color: 'text-lavender-600', bg: 'bg-lavender-50' },
  ];

  const nextTask = taskSummary?.nextTask;

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-lavender-900">
            {t('dashboard.welcome')}, {displayName}
          </h1>
          <p className="mt-1 text-sm text-lavender-500">
            {t('dashboard.progressSummary')}
          </p>
        </div>
        <button onClick={handleStartStudy} className="btn-primary">
          <Timer size={18} />
          {activeSession ? t('study.resumeStudy') : t('study.start')}
        </button>
      </div>

      {/* Active session banner */}
      {activeSession && (
        <div className="flex items-center gap-3 rounded-xl border border-lavender-200 bg-lavender-100 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lavender-600">
            <Timer size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-lavender-800">{t('study.noActiveSession')}</p>
            <p className="text-xs text-lavender-500">{t('study.resumeStudy')}</p>
          </div>
        </div>
      )}

      {/* Today's study stats */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-lavender-900">{t('dashboard.todayEffective')}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {studyStatCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="card p-4">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${card.bg}`}>
                  <Icon size={20} className={card.color} />
                </div>
                <p className="text-xl font-bold tabular-nums text-lavender-900">{card.value}</p>
                <p className="text-sm text-lavender-500">{card.label}</p>
              </div>
            );
          })}
        </div>
        {studyStats && studyStats.todayTotalSeconds > 0 && (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-lavender-50 p-3">
            <Focus size={18} className="text-lavender-600" />
            <span className="text-sm text-lavender-600">{t('dashboard.focusRate')}:</span>
            <ProgressBar value={studyStats.todayFocusPercentage} className="max-w-[200px]" />
            <span className="text-sm font-semibold text-lavender-800">{studyStats.todayFocusPercentage}%</span>
            <span className="ms-auto text-sm text-lavender-500">
              {t('study.distractions')}: {studyStats.todayDistractionCount}
            </span>
          </div>
        )}
      </div>

      {/* Today's Plan + Next Task */}
      {taskSummary && (taskSummary.todayTotal > 0 || nextTask) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Today's Plan */}
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks size={20} className="text-lavender-600" />
                <h2 className="text-lg font-semibold text-lavender-900">{t('dashboard.todaysPlan')}</h2>
              </div>
              <button onClick={() => navigate('/plan')} className="flex items-center gap-1 text-sm font-medium text-lavender-600 hover:text-lavender-700">
                {t('dashboard.viewAll')} <ArrowRight size={16} />
              </button>
            </div>
            {taskSummary.todayTotal === 0 ? (
              <EmptyState
                icon={<ListChecks size={32} />}
                title={t('dashboard.noTasksToday')}
                description={t('dashboard.noTasksDesc')}
                action={<button onClick={() => navigate('/plan')} className="btn-secondary"><Plus size={16} />{t('dashboard.addTask')}</button>}
              />
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-green-600 font-medium">{taskSummary.todayCompleted}</span>
                  <span className="text-lavender-500">{t('dashboard.tasksCompleted')}</span>
                  <span className="text-lavender-400">·</span>
                  <span className="text-lavender-600 font-medium">{taskSummary.todayTotal - taskSummary.todayCompleted}</span>
                  <span className="text-lavender-500">{t('dashboard.tasksRemaining')}</span>
                </div>
                {taskSummary.todayTasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="flex items-center gap-2 rounded-lg border border-lavender-50 p-2">
                    <button
                      onClick={() => handleToggleTask(task.id, task.status)}
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        task.status === 'completed' ? 'border-green-500 bg-green-500 text-white' : 'border-lavender-300 text-transparent hover:border-lavender-500'
                      }`}
                    >
                      {task.status === 'completed' && <CheckCircle2 size={12} />}
                    </button>
                    <span className={`flex-1 truncate text-sm ${task.status === 'completed' ? 'text-lavender-400 line-through' : 'text-lavender-800'}`}>
                      {task.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Next task */}
          {nextTask && (
            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles size={20} className="text-lavender-600" />
                <h2 className="text-lg font-semibold text-lavender-900">{t('dashboard.nextTask')}</h2>
              </div>
              <div className="rounded-lg border border-lavender-100 bg-lavender-50/50 p-4">
                <p className="text-sm font-semibold text-lavender-900">{nextTask.title}</p>
                {nextTask.description && <p className="mt-1 text-xs text-lavender-500">{nextTask.description}</p>}
                <div className="mt-2 flex items-center gap-2">
                  {nextTask.subject_name && <Badge variant="info">{nextTask.subject_name}</Badge>}
                  {nextTask.planned_duration && <Badge variant="default">{nextTask.planned_duration} {t('common.minShort')}</Badge>}
                </div>
                <button onClick={() => navigate('/plan')} className="mt-3 flex items-center gap-1 text-sm font-medium text-lavender-600 hover:text-lavender-700">
                  {t('plan.nextAction')} <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reviews due */}
      {taskSummary && taskSummary.reviewsDue.length > 0 && (
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCcw size={20} className="text-lavender-600" />
              <h2 className="text-lg font-semibold text-lavender-900">{t('dashboard.reviewsDue')}</h2>
              <Badge variant="warning">{taskSummary.reviewsDue.length}</Badge>
            </div>
            <button onClick={() => navigate('/revision')} className="flex items-center gap-1 text-sm font-medium text-lavender-600 hover:text-lavender-700">
              {t('dashboard.viewAll')} <ArrowRight size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {taskSummary.reviewsDue.slice(0, 3).map((review) => (
              <div key={review.id} className="flex items-center gap-3 rounded-lg border border-lavender-50 p-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <RotateCcw size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-lavender-900">{review.title}</p>
                  <p className="text-xs text-lavender-500">{review.review_date}</p>
                </div>
                {review.review_date < new Date().toISOString().split('T')[0] && <Badge variant="warning">{t('dashboard.reviewsOverdue')}</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completion banner */}
      <div className="card flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-lavender-100">
          <TrendingUp size={24} className="text-lavender-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-lavender-500">{t('dashboard.lessonsProgress')}</p>
          <div className="mt-2 flex items-center gap-3">
            <ProgressBar value={stats?.completionPercentage ?? 0} className="flex-1" />
            <span className="text-lg font-bold text-lavender-900">{stats?.completionPercentage ?? 0}%</span>
          </div>
        </div>
      </div>

      {/* Active goals */}
      {activeGoals.length > 0 && (
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={20} className="text-lavender-600" />
              <h2 className="text-lg font-semibold text-lavender-900">{t('dashboard.activeGoals')}</h2>
            </div>
            <button onClick={() => navigate('/goals')} className="flex items-center gap-1 text-sm font-medium text-lavender-600 hover:text-lavender-700">
              {t('dashboard.viewAll')} <ArrowRight size={16} />
            </button>
          </div>
          <div className="space-y-3">
            {activeGoals.map((goal) => {
              const isTimeGoal = goal.goal_type.endsWith('_effective_time');
              const remainingLabel = isTimeGoal
                ? formatDuration(goal.remaining * 60)
                : `${Math.round(goal.remaining)}`;
              return (
                <div key={goal.id} className="flex items-center gap-4 rounded-lg border border-lavender-50 p-3 transition-colors hover:border-lavender-200 hover:bg-lavender-50/50">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-lavender-100">
                    <Target size={20} className="text-lavender-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-lavender-900">
                      {goal.title || goal.goal_type.replace(/_/g, ' ')}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <ProgressBar value={goal.percentage} className="max-w-[200px]" />
                      <span className="text-xs text-lavender-500">
                        {goal.percentage}% · {remainingLabel} · {goal.end_date}
                      </span>
                    </div>
                  </div>
                  <Badge variant={goal.percentage >= 100 ? 'success' : 'info'}>{goal.percentage}%</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-4">
              <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${card.bg}`}>
                <Icon size={20} className={card.color} />
              </div>
              <p className="text-2xl font-bold text-lavender-900">{card.value}</p>
              <p className="text-sm text-lavender-500">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Upcoming exams & deadlines */}
      {(upcoming.nextExam || upcoming.nextDeadline) && (
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-lavender-900">{t('dashboard.upcoming')}</h2>
            <button onClick={() => navigate('/exams')} className="flex items-center gap-1 text-sm font-medium text-lavender-600 hover:text-lavender-700">
              {t('dashboard.viewAll')} <ArrowRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {upcoming.nextExam && (
              <UpcomingItem icon={CalendarClock} title={upcoming.nextExam.title} subtitle={upcoming.nextExam.subject_name ?? t('exams.noSubject')} date={upcoming.nextExam.exam_date} t={t} />
            )}
            {upcoming.nextDeadline && (
              <UpcomingItem icon={FileText} title={upcoming.nextDeadline.title} subtitle={upcoming.nextDeadline.subject_name ?? t('exams.noSubject')} date={upcoming.nextDeadline.due_date} t={t} />
            )}
          </div>
        </div>
      )}

      {/* Recent subjects */}
      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-lavender-900">{t('dashboard.recentSubjects')}</h2>
          <button onClick={() => navigate('/learning')} className="flex items-center gap-1 text-sm font-medium text-lavender-600 hover:text-lavender-700">
            {t('dashboard.viewAll')} <ArrowRight size={16} />
          </button>
        </div>
        {recentSubjects.length === 0 ? (
          <EmptyState
            icon={<GraduationCap size={40} />}
            title={t('dashboard.noSubjects')}
            description={t('dashboard.noSubjectsDesc')}
            action={<button onClick={() => navigate('/learning')} className="btn-primary"><Sparkles size={18} />{t('dashboard.goToLearning')}</button>}
          />
        ) : (
          <div className="space-y-3">
            {recentSubjects.map((subject) => {
              const progress = subject.lesson_count > 0 ? Math.round((subject.completed_lessons / subject.lesson_count) * 100) : 0;
              return (
                <div key={subject.id} className="flex items-center gap-4 rounded-lg border border-lavender-50 p-3 transition-colors hover:border-lavender-200 hover:bg-lavender-50/50">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-lavender-100">
                    <GraduationCap size={20} className="text-lavender-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-lavender-900">{subject.name}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <ProgressBar value={progress} className="max-w-[200px]" />
                      <span className="text-xs text-lavender-500">
                        {subject.completed_lessons}/{subject.lesson_count} {t('learning.lessonsCount')}
                      </span>
                    </div>
                  </div>
                  <Badge variant={progress === 100 ? 'success' : progress > 0 ? 'info' : 'default'}>{progress}%</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <StartStudyModal
        open={startModalOpen}
        onClose={() => setStartModalOpen(false)}
        onStart={async (params) => {
          const { startSession } = useStudyStore.getState();
          await startSession(params);
          setStartModalOpen(false);
          navigate('/study');
        }}
      />
    </div>
  );
}

function UpcomingItem({
  icon: Icon, title, subtitle, date, t,
}: {
  icon: typeof CalendarClock; title: string; subtitle: string; date: string; t: (k: string) => string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date + 'T00:00:00');
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const label = days === 0 ? t('exams.today') : days > 0 ? `${days} ${days !== 1 ? t('exams.daysLeft') : t('exams.dayLeft')}` : t('exams.past');

  return (
    <div className="flex items-center gap-3 rounded-lg border border-lavender-50 p-3 transition-colors hover:border-lavender-200 hover:bg-lavender-50/50">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-lavender-100">
        <Icon size={20} className="text-lavender-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-lavender-900">{title}</p>
        <p className="text-xs text-lavender-500">{subtitle} · {date}</p>
      </div>
      <Badge variant={days === 0 ? 'warning' : days > 0 ? 'info' : 'default'}>{label}</Badge>
    </div>
  );
}
