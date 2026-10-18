import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchExams,
  createExam,
  updateExam,
  deleteExam,
  fetchDeadlines,
  createDeadline,
  updateDeadline,
  deleteDeadline,
  fetchAllSubjects,
  fetchLearningPaths,
  type DashboardUpcoming,
} from '@/lib/api';
import type {
  ExamWithNames,
  DeadlineWithNames,
  DeadlineStatus,
  SubjectWithProgress,
  LearningPathWithCounts,
} from '@/types/database';
import { formatDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { Spinner, EmptyState, ErrorMessage } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog, Badge } from '@/components/ui/ConfirmDialog';
import {
  CalendarClock,
  FileText,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  GraduationCap,
  MapPin,
  Clock,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

function todayLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysRemaining(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function daysRemainingLabel(dateStr: string, t: (k: string) => string): { label: string; variant: 'default' | 'success' | 'warning' | 'info' } {
  const days = daysRemaining(dateStr);
  if (days === 0) return { label: t('exams.today'), variant: 'warning' };
  if (days > 0) return { label: `${days} ${days !== 1 ? t('exams.daysLeft') : t('exams.dayLeft')}`, variant: 'info' };
  return { label: t('exams.past'), variant: 'default' };
}

function deadlineStatusLabel(dateStr: string, status: DeadlineStatus, t: (k: string) => string): { label: string; variant: 'default' | 'success' | 'warning' | 'info' } {
  if (status === 'completed') return { label: t('exams.completed2'), variant: 'success' };
  const days = daysRemaining(dateStr);
  if (days < 0) return { label: t('exams.overdue'), variant: 'warning' };
  if (days === 0) return { label: t('exams.today'), variant: 'warning' };
  return { label: `${days} ${days !== 1 ? t('exams.daysLeft') : t('exams.dayLeft')}`, variant: 'info' };
}

function formatTime(timeStr: string | null): string | null {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${period}`;
}

export function ExamsDeadlinesPage() {
  const navigate = useNavigate();
  const t = useT();
  const [exams, setExams] = useState<ExamWithNames[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineWithNames[]>([]);
  const [subjects, setSubjects] = useState<SubjectWithProgress[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPathWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamWithNames | null>(null);
  const [deleteExamTarget, setDeleteExamTarget] = useState<ExamWithNames | null>(null);

  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<DeadlineWithNames | null>(null);
  const [deleteDeadlineTarget, setDeleteDeadlineTarget] = useState<DeadlineWithNames | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ex, dl, subs, lps] = await Promise.all([
        fetchExams(),
        fetchDeadlines(),
        fetchAllSubjects(),
        fetchLearningPaths(),
      ]);
      setExams(ex);
      setDeadlines(dl);
      setSubjects(subs);
      setLearningPaths(lps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const todayStr = todayLocalDate();

  const upcomingExams = exams
    .filter((e) => e.exam_date >= todayStr)
    .sort((a, b) => a.exam_date.localeCompare(b.exam_date));

  const upcomingDeadlines = deadlines
    .filter((d) => d.status === 'pending')
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const completedDeadlines = deadlines
    .filter((d) => d.status === 'completed')
    .sort((a, b) => b.due_date.localeCompare(a.due_date));

  const handleExamSaved = async () => {
    setExamModalOpen(false);
    setEditingExam(null);
    await load();
  };

  const handleDeadlineSaved = async () => {
    setDeadlineModalOpen(false);
    setEditingDeadline(null);
    await load();
  };

  const handleDeleteExam = async () => {
    if (!deleteExamTarget) return;
    try {
      await deleteExam(deleteExamTarget.id);
      setDeleteExamTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete exam');
    }
  };

  const handleDeleteDeadline = async () => {
    if (!deleteDeadlineTarget) return;
    try {
      await deleteDeadline(deleteDeadlineTarget.id);
      setDeleteDeadlineTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete deadline');
    }
  };

  const handleToggleDeadline = async (d: DeadlineWithNames) => {
    try {
      await updateDeadline(d.id, { status: d.status === 'completed' ? 'pending' : 'completed' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update deadline');
    }
  };

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
      <div>
        <h1 className="text-2xl font-bold text-lavender-900">{t('exams.title')}</h1>
        <p className="mt-1 text-sm text-lavender-500">{t('exams.subtitle')}</p>
      </div>

      {error && <ErrorMessage message={error} />}

      {/* Upcoming Exams */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock size={20} className="text-lavender-600" />
            <h2 className="text-lg font-semibold text-lavender-900">{t('exams.upcomingExams')}</h2>
            <Badge variant="default">{upcomingExams.length}</Badge>
          </div>
          <button
            onClick={() => {
              setEditingExam(null);
              setExamModalOpen(true);
            }}
            className="btn-primary"
          >
            <Plus size={18} />
            {t('exams.addExam')}
          </button>
        </div>

        {upcomingExams.length === 0 ? (
          <div className="card p-6">
            <EmptyState
              icon={<CalendarClock size={40} />}
              title={t('exams.noExams')}
              description={t('exams.noExamsDesc')}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingExams.map((exam) => {
              const remain = daysRemainingLabel(exam.exam_date, t);
              return (
                <div key={exam.id} className="card group flex items-center gap-4 p-4">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-lavender-100">
                    <CalendarClock size={22} className="text-lavender-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-lavender-900">{exam.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-lavender-500">
                      <span className="flex items-center gap-1">
                        <GraduationCap size={12} /> {exam.subject_name ?? t('exams.noSubject')}
                      </span>
                      <span>{formatDate(exam.exam_date)}</span>
                      {exam.start_time && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {formatTime(exam.start_time)}
                        </span>
                      )}
                      {exam.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} /> {exam.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant={remain.variant}>{remain.label}</Badge>
                  <div className="flex flex-shrink-0 gap-1">
                    <button
                      onClick={() => {
                        setEditingExam(exam);
                        setExamModalOpen(true);
                      }}
                      className="rounded-lg p-2 text-lavender-400 transition-colors hover:bg-lavender-50 hover:text-lavender-600"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteExamTarget(exam)}
                      className="rounded-lg p-2 text-lavender-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming Deadlines */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-lavender-600" />
            <h2 className="text-lg font-semibold text-lavender-900">{t('exams.upcomingDeadlines')}</h2>
            <Badge variant="default">{upcomingDeadlines.length}</Badge>
          </div>
          <button
            onClick={() => {
              setEditingDeadline(null);
              setDeadlineModalOpen(true);
            }}
            className="btn-primary"
          >
            <Plus size={18} />
            {t('exams.addDeadline')}
          </button>
        </div>

        {upcomingDeadlines.length === 0 && completedDeadlines.length === 0 ? (
          <div className="card p-6">
            <EmptyState
              icon={<FileText size={40} />}
              title={t('exams.noDeadlines')}
              description={t('exams.noDeadlinesDesc')}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingDeadlines.map((d) => {
              const status = deadlineStatusLabel(d.due_date, d.status, t);
              return (
                <div key={d.id} className="card group flex items-center gap-4 p-4">
                  <button
                    onClick={() => handleToggleDeadline(d)}
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-lavender-300 text-lavender-400 transition-colors hover:border-lavender-500 hover:text-lavender-600"
                    title={t('exams.markCompleted')}
                  >
                    <Circle size={14} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-lavender-900">{d.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-lavender-500">
                      {d.subject_name && (
                        <span className="flex items-center gap-1">
                          <GraduationCap size={12} /> {d.subject_name}
                        </span>
                      )}
                      {!d.subject_name && (
                        <span className="flex items-center gap-1">
                          <GraduationCap size={12} /> {t('exams.noSubject')}
                        </span>
                      )}
                      <span>{formatDate(d.due_date)}</span>
                      {d.due_time && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {formatTime(d.due_time)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <div className="flex flex-shrink-0 gap-1">
                    <button
                      onClick={() => {
                        setEditingDeadline(d);
                        setDeadlineModalOpen(true);
                      }}
                      className="rounded-lg p-2 text-lavender-400 transition-colors hover:bg-lavender-50 hover:text-lavender-600"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteDeadlineTarget(d)}
                      className="rounded-lg p-2 text-lavender-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Completed deadlines */}
            {completedDeadlines.length > 0 && (
              <div className="pt-2">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-lavender-400">
                  {t('exams.completed')}
                </p>
                {completedDeadlines.map((d) => (
                  <div
                    key={d.id}
                    className="card flex items-center gap-4 p-3 opacity-60"
                  >
                    <button
                      onClick={() => handleToggleDeadline(d)}
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600"
                      title={t('exams.markPending')}
                    >
                      <CheckCircle2 size={14} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-lavender-700 line-through">
                        {d.title}
                      </p>
                      <span className="text-xs text-lavender-400">{formatDate(d.due_date)}</span>
                    </div>
                    <Badge variant="success">{t('exams.completed2')}</Badge>
                    <button
                      onClick={() => setDeleteDeadlineTarget(d)}
                      className="rounded-lg p-2 text-lavender-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Exam modal */}
      <ExamFormModal
        open={examModalOpen}
        onClose={() => {
          setExamModalOpen(false);
          setEditingExam(null);
        }}
        onSave={handleExamSaved}
        subjects={subjects}
        learningPaths={learningPaths}
        editingExam={editingExam}
        t={t}
      />

      {/* Deadline modal */}
      <DeadlineFormModal
        open={deadlineModalOpen}
        onClose={() => {
          setDeadlineModalOpen(false);
          setEditingDeadline(null);
        }}
        onSave={handleDeadlineSaved}
        subjects={subjects}
        learningPaths={learningPaths}
        editingDeadline={editingDeadline}
        t={t}
      />

      {/* Delete confirmations */}
      <ConfirmDialog
        open={!!deleteExamTarget}
        onClose={() => setDeleteExamTarget(null)}
        onConfirm={handleDeleteExam}
        title={t('exams.deleteExam')}
        message={`"${deleteExamTarget?.title}" — ${t('exams.deleteConfirm')}`}
        confirmLabel={t('common.delete')}
        destructive
      />
      <ConfirmDialog
        open={!!deleteDeadlineTarget}
        onClose={() => setDeleteDeadlineTarget(null)}
        onConfirm={handleDeleteDeadline}
        title={t('exams.deleteDeadline')}
        message={`"${deleteDeadlineTarget?.title}" — ${t('exams.deleteConfirm')}`}
        confirmLabel={t('common.delete')}
        destructive
      />
    </div>
  );
}

function ExamFormModal({
  open,
  onClose,
  onSave,
  subjects,
  learningPaths,
  editingExam,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  subjects: SubjectWithProgress[];
  learningPaths: LearningPathWithCounts[];
  editingExam: ExamWithNames | null;
  t: (k: string) => string;
}) {
  const [title, setTitle] = useState('');
  const [examDate, setExamDate] = useState(todayLocalDate());
  const [startTime, setStartTime] = useState('');
  const [location, setLocation] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [learningPathId, setLearningPathId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editingExam) {
        setTitle(editingExam.title);
        setExamDate(editingExam.exam_date);
        setStartTime(editingExam.start_time ?? '');
        setLocation(editingExam.location ?? '');
        setSubjectId(editingExam.subject_id ?? '');
        setLearningPathId(editingExam.learning_path_id ?? '');
      } else {
        setTitle('');
        setExamDate(todayLocalDate());
        setStartTime('');
        setLocation('');
        setSubjectId('');
        setLearningPathId('');
      }
      setFormError(null);
    }
  }, [open, editingExam]);

  const handleSubmit = async () => {
    setFormError(null);

    if (!title.trim()) {
      setFormError(t('common.required'));
      return;
    }
    if (!examDate) {
      setFormError(t('exams.examDate'));
      return;
    }

    setSaving(true);
    try {
      const params = {
        title: title.trim(),
        exam_date: examDate,
        start_time: startTime || null,
        location: location.trim() || null,
        subject_id: subjectId || null,
        learning_path_id: learningPathId || null,
      };
      if (editingExam) {
        await updateExam(editingExam.id, params);
      } else {
        await createExam(params);
      }
      onSave();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('exams.title'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingExam ? t('exams.editExam') : t('exams.createExam')}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {formError && <ErrorMessage message={formError} />}

        <div>
          <label className="mb-1 block text-sm font-medium text-lavender-700">{t('exams.examTitle')}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field"
            placeholder={t('exams.examTitle')}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-lavender-700">{t('common.learningPath')}</label>
          <select
            value={learningPathId}
            onChange={(e) => {
              setLearningPathId(e.target.value);
              setSubjectId('');
            }}
            className="input-field"
          >
            <option value="">{t('common.none')}</option>
            {learningPaths.map((lp) => (
              <option key={lp.id} value={lp.id}>{lp.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-lavender-700">{t('common.subject')}</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="input-field"
          >
            <option value="">{t('common.none')}</option>
            {subjects
              .filter((s) => !learningPathId || s.learning_path_id === learningPathId)
              .map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-lavender-700">{t('exams.examDate')}</label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-lavender-700">{t('exams.startTime')}</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-lavender-700">{t('exams.location')}</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="input-field"
            placeholder={t('exams.location')}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary">
            {saving ? <Spinner size={18} /> : editingExam ? t('common.save') : t('exams.createExam')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeadlineFormModal({
  open,
  onClose,
  onSave,
  subjects,
  learningPaths,
  editingDeadline,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  subjects: SubjectWithProgress[];
  learningPaths: LearningPathWithCounts[];
  editingDeadline: DeadlineWithNames | null;
  t: (k: string) => string;
}) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(todayLocalDate());
  const [dueTime, setDueTime] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [learningPathId, setLearningPathId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editingDeadline) {
        setTitle(editingDeadline.title);
        setDueDate(editingDeadline.due_date);
        setDueTime(editingDeadline.due_time ?? '');
        setDescription(editingDeadline.description ?? '');
        setSubjectId(editingDeadline.subject_id ?? '');
        setLearningPathId(editingDeadline.learning_path_id ?? '');
      } else {
        setTitle('');
        setDueDate(todayLocalDate());
        setDueTime('');
        setDescription('');
        setSubjectId('');
        setLearningPathId('');
      }
      setFormError(null);
    }
  }, [open, editingDeadline]);

  const handleSubmit = async () => {
    setFormError(null);

    if (!title.trim()) {
      setFormError(t('common.required'));
      return;
    }
    if (!dueDate) {
      setFormError(t('exams.dueDate'));
      return;
    }

    setSaving(true);
    try {
      const params = {
        title: title.trim(),
        due_date: dueDate,
        due_time: dueTime || null,
        description: description.trim() || null,
        subject_id: subjectId || null,
        learning_path_id: learningPathId || null,
      };
      if (editingDeadline) {
        await updateDeadline(editingDeadline.id, params);
      } else {
        await createDeadline(params);
      }
      onSave();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('exams.title'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingDeadline ? t('exams.editDeadline') : t('exams.createDeadline')}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {formError && <ErrorMessage message={formError} />}

        <div>
          <label className="mb-1 block text-sm font-medium text-lavender-700">{t('exams.deadlineTitle')}</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field"
            placeholder={t('exams.deadlineTitle')}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-lavender-700">{t('common.learningPath')}</label>
          <select
            value={learningPathId}
            onChange={(e) => {
              setLearningPathId(e.target.value);
              setSubjectId('');
            }}
            className="input-field"
          >
            <option value="">{t('common.none')}</option>
            {learningPaths.map((lp) => (
              <option key={lp.id} value={lp.id}>{lp.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-lavender-700">{t('common.subject')}</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="input-field"
          >
            <option value="">{t('common.none')}</option>
            {subjects
              .filter((s) => !learningPathId || s.learning_path_id === learningPathId)
              .map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-lavender-700">{t('exams.dueDate')}</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-lavender-700">{t('exams.dueTime')}</label>
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-lavender-700">{t('exams.description')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-field min-h-[60px] resize-y"
            placeholder={t('exams.description')}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary">
            {saving ? <Spinner size={18} /> : editingDeadline ? t('common.save') : t('exams.createDeadline')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
