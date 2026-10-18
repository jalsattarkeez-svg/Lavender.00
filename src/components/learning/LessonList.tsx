import { useEffect, useState } from 'react';
import {
  fetchLessons,
  createLesson,
  updateLesson,
  deleteLesson,
  updateLessonStatus,
  reorderLessons,
  fetchTaskSteps,
  createTaskStep,
  updateTaskStep,
  deleteTaskStep,
} from '@/lib/api';
import type { SubjectWithProgress, Lesson, LessonStatus, TaskStep } from '@/types/database';
import { Spinner, EmptyState, ErrorMessage } from '@/components/ui/Feedback';
import { Modal, ConfirmDialog, ProgressBar, Badge } from '@/components/ui/ConfirmDialog';
import { Plus, Pencil, Trash2, ArrowLeft, ClipboardList, Circle, CircleDot, CircleCheck as CheckCircle2, GripVertical, ChevronDown, ChevronRight, ListChecks } from 'lucide-react';
import { useT } from '@/lib/i18n';

interface LessonFormState {
  title: string;
  description: string;
}

const statusConfig: Record<LessonStatus, { label: string; icon: typeof Circle; color: string; badge: 'default' | 'info' | 'success' }> = {
  not_started: { label: 'Not started', icon: Circle, color: 'text-lavender-300', badge: 'default' },
  in_progress: { label: 'In progress', icon: CircleDot, color: 'text-amber-500', badge: 'info' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-green-500', badge: 'success' },
};

export function LessonList({
  subject,
  onBack,
}: {
  subject: SubjectWithProgress;
  onBack: () => void;
}) {
  const t = useT();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Lesson | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lesson | null>(null);
  const [form, setForm] = useState<LessonFormState>({ title: '', description: '' });
  const [saving, setSaving] = useState(false);

  // Lesson steps state
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [lessonSteps, setLessonSteps] = useState<Record<string, TaskStep[]>>({});
  const [stepInputs, setStepInputs] = useState<Record<string, string>>({});
  const [stepsLoading, setStepsLoading] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLessons(subject.id);
      setLessons(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lessons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [subject.id]);

  const completedCount = lessons.filter((l) => l.status === 'completed').length;
  const totalCount = lessons.length;
  const progress =
    totalCount > 0
      ? Math.round((completedCount / totalCount) * 100)
      : 0;

  const loadSteps = async (lessonId: string) => {
    setStepsLoading((prev) => new Set(prev).add(lessonId));
    try {
      const steps = await fetchTaskSteps('lesson', lessonId);
      setLessonSteps((prev) => ({ ...prev, [lessonId]: steps }));
    } catch {
      setError(t('common.error'));
    } finally {
      setStepsLoading((prev) => {
        const next = new Set(prev);
        next.delete(lessonId);
        return next;
      });
    }
  };

  const toggleExpand = (lessonId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
        if (!lessonSteps[lessonId]) loadSteps(lessonId);
      }
      return next;
    });
  };

  const handleAddStep = async (lessonId: string) => {
    const title = stepInputs[lessonId]?.trim();
    if (!title) return;
    try {
      const existing = lessonSteps[lessonId] ?? [];
      await createTaskStep({
        parent_type: 'lesson',
        lesson_id: lessonId,
        title,
        order_index: existing.length,
      });
      setStepInputs((prev) => ({ ...prev, [lessonId]: '' }));
      await loadSteps(lessonId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleToggleStep = async (step: TaskStep) => {
    try {
      await updateTaskStep(step.id, { completed: !step.completed });
      const lessonId = step.lesson_id;
      if (lessonId) await loadSteps(lessonId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleDeleteStep = async (stepId: string, lessonId: string | null) => {
    if (!lessonId) return;
    try {
      await deleteTaskStep(stepId);
      await loadSteps(lessonId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm({ title: '', description: '' });
    setModalOpen(true);
  };

  const openEdit = (lesson: Lesson) => {
    setEditTarget(lesson);
    setForm({ title: lesson.title, description: lesson.description ?? '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editTarget) {
        await updateLesson(editTarget.id, {
          title: form.title.trim(),
          description: form.description.trim() || null,
        });
      } else {
        const nextOrder = lessons.length > 0 ? Math.max(...lessons.map((l) => l.order_index)) + 1 : 0;
        await createLesson(subject.id, form.title.trim(), form.description.trim() || null, nextOrder);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lesson');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lesson: Lesson) => {
    try {
      await deleteLesson(lesson.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete lesson');
    }
  };

  const handleStatusChange = async (lesson: Lesson, newStatus: LessonStatus) => {
    try {
      await updateLessonStatus(lesson.id, newStatus);
      setLessons((prev) =>
        prev.map((l) => (l.id === lesson.id ? { ...l, status: newStatus } : l))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update lesson status');
    }
  };

  const moveLesson = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= lessons.length) return;
    const reordered = [...lessons];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    const updated = reordered.map((l, i) => ({ id: l.id, order_index: i }));
    setLessons(reordered);
    try {
      await reorderLessons(updated);
    } catch {
      await load();
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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-ghost">
          <ArrowLeft size={18} />
          {t('common.cancel')}
        </button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-lavender-900">{subject.name}</h2>
          {subject.description && (
            <p className="mt-0.5 text-sm text-lavender-500">{subject.description}</p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar value={progress} className="max-w-[200px]" />
            <span className="text-sm text-lavender-500">
              {completedCount}/{totalCount} {t('learning.completed')} ({progress}%)
            </span>
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} />
          {t('learning.addLesson')}
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {lessons.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={<ClipboardList size={40} />}
            title={t('learning.noLessons')}
            description={t('learning.noLessonsDesc')}
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus size={18} />
                {t('learning.addLesson')}
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          {lessons.map((lesson, index) => {
            const config = statusConfig[lesson.status];
            const StatusIcon = config.icon;
            const isExpanded = expandedSteps.has(lesson.id);
            const steps = lessonSteps[lesson.id] ?? [];
            const stepsAreLoading = stepsLoading.has(lesson.id);
            const completedSteps = steps.filter((s) => s.completed).length;
            return (
              <div key={lesson.id} className="card group transition-all hover:shadow-md">
                <div className="flex items-center gap-3 p-3">
                  {/* Reorder controls */}
                  <div className="hidden flex-col sm:flex">
                    <button
                      onClick={() => moveLesson(index, 'up')}
                      disabled={index === 0}
                      className="text-lavender-300 transition-colors hover:text-lavender-600 disabled:opacity-30"
                    >
                      <GripVertical size={16} className="rotate-180" />
                    </button>
                    <button
                      onClick={() => moveLesson(index, 'down')}
                      disabled={index === lessons.length - 1}
                      className="text-lavender-300 transition-colors hover:text-lavender-600 disabled:opacity-30"
                    >
                      <GripVertical size={16} />
                    </button>
                  </div>

                  {/* Status toggle */}
                  <button
                    onClick={() => {
                      const next: LessonStatus =
                        lesson.status === 'not_started'
                          ? 'in_progress'
                          : lesson.status === 'in_progress'
                          ? 'completed'
                          : 'not_started';
                      handleStatusChange(lesson, next);
                    }}
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-lavender-100 ${config.color}`}
                    title={`${t('common.status')}: ${lesson.status === 'not_started' ? t('learning.notStarted') : lesson.status === 'in_progress' ? t('learning.inProgress') : t('learning.completed')}`}
                  >
                    <StatusIcon size={20} />
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${lesson.status === 'completed' ? 'text-lavender-400 line-through' : 'text-lavender-900'}`}>
                      {lesson.title}
                    </p>
                    {lesson.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-lavender-400">{lesson.description}</p>
                    )}
                  </div>

                  <Badge variant={config.badge}>{lesson.status === 'not_started' ? t('learning.notStarted') : lesson.status === 'in_progress' ? t('learning.inProgress') : t('learning.completed')}</Badge>

                  {/* Steps toggle */}
                  <button
                    onClick={() => toggleExpand(lesson.id)}
                    className="rounded-lg p-1.5 text-lavender-400 transition-colors hover:bg-lavender-50 hover:text-lavender-600"
                    title={t('learning.steps')}
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(lesson)}
                      className="rounded-lg p-1.5 text-lavender-400 hover:bg-lavender-100 hover:text-lavender-600"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(lesson)}
                      className="rounded-lg p-1.5 text-lavender-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Lesson steps (expandable) */}
                {isExpanded && (
                  <div className="border-t border-lavender-50 px-4 py-3">
                    <div className="mb-2 flex items-center gap-2 text-xs text-lavender-500">
                      <ListChecks size={14} />
                      {steps.length > 0 && (
                        <span>{completedSteps}/{steps.length} {t('learning.stepsProgress')}</span>
                      )}
                    </div>

                    {stepsAreLoading ? (
                      <div className="flex justify-center py-3">
                        <Spinner size={18} />
                      </div>
                    ) : steps.length === 0 ? (
                      <p className="mb-2 text-xs text-lavender-400">{t('learning.noSteps')}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {steps.map((step) => (
                          <div key={step.id} className="flex items-center gap-2 group/step">
                            <button
                              onClick={() => handleToggleStep(step)}
                              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                                step.completed
                                  ? 'border-green-500 bg-green-500 text-white'
                                  : 'border-lavender-300 text-transparent hover:border-lavender-500'
                              }`}
                            >
                              {step.completed && <CheckCircle2 size={12} />}
                            </button>
                            <span className={`flex-1 text-sm ${step.completed ? 'text-lavender-400 line-through' : 'text-lavender-700'}`}>
                              {step.title}
                            </span>
                            <button
                              onClick={() => handleDeleteStep(step.id, step.lesson_id)}
                              className="text-lavender-300 opacity-0 transition-opacity hover:text-red-500 group-hover/step:opacity-100"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={stepInputs[lesson.id] ?? ''}
                        onChange={(e) => setStepInputs((prev) => ({ ...prev, [lesson.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddStep(lesson.id)}
                        className="input-field !py-2 text-sm"
                        placeholder={t('learning.addStep')}
                      />
                      <button
                        onClick={() => handleAddStep(lesson.id)}
                        className="btn-ghost !px-3 !py-2"
                        disabled={!stepInputs[lesson.id]?.trim()}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? t('learning.editLesson') : t('learning.addLesson')}
      >
        <div className="space-y-4">
          <div>
            <label className="label-text" htmlFor="lesson-title">{t('learning.lessonTitle')}</label>
            <input
              id="lesson-title"
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
              placeholder="e.g. Chapter 1: Introduction"
            />
          </div>
          <div>
            <label className="label-text" htmlFor="lesson-desc">{t('common.description')} <span className="text-lavender-300">{t('common.optional')}</span></label>
            <textarea
              id="lesson-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field min-h-[80px] resize-y"
              placeholder="What does this lesson cover?"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} disabled={saving || !form.title.trim()} className="btn-primary">
              {saving ? <Spinner size={18} /> : editTarget ? t('learning.saveChanges') : t('learning.addLesson')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title={t('learning.deleteLesson')}
        message={`Delete "${deleteTarget?.title}"? ${t('learning.deleteConfirm')}`}
        confirmLabel={t('common.delete')}
        destructive
      />
    </div>
  );
}
