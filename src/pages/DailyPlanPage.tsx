import { useState, useEffect, useCallback } from 'react';
import {
  fetchStudyTasks,
  createStudyTask,
  updateStudyTask,
  deleteStudyTask,
  carryForwardTasks,
  fetchTaskSteps,
  createTaskStep,
  updateTaskStep,
  deleteTaskStep,
  fetchAllSubjects,
  fetchLessons,
  fetchLearningPaths,
} from '@/lib/api';
import type { StudyTaskWithNames, SubjectWithProgress, LearningPathWithCounts, TaskStep, StepParentType } from '@/types/database';
import { useT } from '@/lib/i18n';
import { Spinner, EmptyState, ErrorMessage } from '@/components/ui/Feedback';
import { Modal, ConfirmDialog, Badge, ProgressBar } from '@/components/ui/ConfirmDialog';
import {
  Plus, Pencil, Trash2, CheckCircle2, Circle, CalendarDays,
  Clock, BookOpen, ChevronDown, ChevronRight, ListChecks, RotateCcw,
} from 'lucide-react';

function todayLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface TaskFormState {
  title: string;
  description: string;
  planned_date: string;
  planned_duration: string;
  learning_path_id: string;
  subject_id: string;
  lesson_id: string;
}

export function DailyPlanPage() {
  const t = useT();
  const [tasks, setTasks] = useState<StudyTaskWithNames[]>([]);
  const [subjects, setSubjects] = useState<SubjectWithProgress[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPathWithCounts[]>([]);
  const [lessons, setLessons] = useState<{ id: string; title: string; subject_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StudyTaskWithNames | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyTaskWithNames | null>(null);
  const [form, setForm] = useState<TaskFormState>({
    title: '', description: '', planned_date: todayLocalDate(),
    planned_duration: '', learning_path_id: '', subject_id: '', lesson_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [taskSteps, setTaskSteps] = useState<Record<string, TaskStep[]>>({});
  const [stepInputs, setStepInputs] = useState<Record<string, string>>({});
  const [carryMsg, setCarryMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [taskData, subData, lpData] = await Promise.all([
        fetchStudyTasks(),
        fetchAllSubjects(),
        fetchLearningPaths(),
      ]);
      setTasks(taskData);
      setSubjects(subData);
      setLearningPaths(lpData);
      const allLessons: { id: string; title: string; subject_id: string }[] = [];
      for (const s of subData) {
        const ls = await fetchLessons(s.id);
        allLessons.push(...ls.map((l) => ({ id: l.id, title: l.title, subject_id: l.subject_id })));
      }
      setLessons(allLessons);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const loadSteps = async (taskId: string) => {
    try {
      const steps = await fetchTaskSteps('study_task', taskId);
      setTaskSteps((prev) => ({ ...prev, [taskId]: steps }));
    } catch {
      // ignore
    }
  };

  const toggleExpand = (taskId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
        if (!taskSteps[taskId]) loadSteps(taskId);
      }
      return next;
    });
  };

  const openCreate = () => {
    setEditingTask(null);
    setForm({
      title: '', description: '', planned_date: todayLocalDate(),
      planned_duration: '', learning_path_id: '', subject_id: '', lesson_id: '',
    });
    setModalOpen(true);
  };

  const openEdit = (task: StudyTaskWithNames) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description ?? '',
      planned_date: task.planned_date,
      planned_duration: task.planned_duration?.toString() ?? '',
      learning_path_id: task.learning_path_id ?? '',
      subject_id: task.subject_id ?? '',
      lesson_id: task.lesson_id ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const params = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        planned_date: form.planned_date,
        planned_duration: form.planned_duration ? parseInt(form.planned_duration, 10) : null,
        learning_path_id: form.learning_path_id || null,
        subject_id: form.subject_id || null,
        lesson_id: form.lesson_id || null,
      };
      if (editingTask) {
        await updateStudyTask(editingTask.id, { ...params, status: undefined });
      } else {
        await createStudyTask(params);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (task: StudyTaskWithNames) => {
    try {
      await updateStudyTask(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleDelete = async (task: StudyTaskWithNames) => {
    try {
      await deleteStudyTask(task.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleCarryForward = async () => {
    const today = todayLocalDate();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    try {
      const count = await carryForwardTasks(today, tomorrowStr);
      if (count > 0) {
        setCarryMsg(`${count} ${t('plan.carriedForward')}`);
        setTimeout(() => setCarryMsg(null), 3000);
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleAddStep = async (taskId: string) => {
    const title = stepInputs[taskId]?.trim();
    if (!title) return;
    try {
      const existing = taskSteps[taskId] ?? [];
      await createTaskStep({
        parent_type: 'study_task',
        study_task_id: taskId,
        title,
        order_index: existing.length,
      });
      setStepInputs((prev) => ({ ...prev, [taskId]: '' }));
      await loadSteps(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleToggleStep = async (step: TaskStep) => {
    try {
      await updateTaskStep(step.id, { completed: !step.completed });
      for (const [tid] of Object.entries(expandedSteps)) {
        await loadSteps(tid);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleDeleteStep = async (stepId: string, taskId: string) => {
    try {
      await deleteTaskStep(stepId);
      await loadSteps(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const filteredSubjects = form.learning_path_id
    ? subjects.filter((s) => s.learning_path_id === form.learning_path_id)
    : subjects;
  const filteredLessons = form.subject_id
    ? lessons.filter((l) => l.subject_id === form.subject_id)
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={36} />
      </div>
    );
  }

  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const remainingCount = tasks.length - completedCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-lavender-900">{t('plan.title')}</h1>
          <p className="mt-1 text-sm text-lavender-500">{t('plan.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {remainingCount > 0 && (
            <button onClick={handleCarryForward} className="btn-secondary" title={t('plan.carryForward')}>
              <RotateCcw size={18} />
              <span className="hidden sm:inline">{t('plan.carryForward')}</span>
            </button>
          )}
          <button onClick={openCreate} className="btn-primary">
            <Plus size={18} />
            {t('plan.addTask')}
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}
      {carryMsg && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {carryMsg}
        </div>
      )}

      {tasks.length > 0 && (
        <div className="flex items-center gap-4 rounded-lg border border-lavender-100 bg-white px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 size={18} className="text-green-600" />
            <span className="font-medium text-lavender-900">{completedCount}</span>
            <span className="text-lavender-500">{t('plan.completed')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Circle size={18} className="text-lavender-400" />
            <span className="font-medium text-lavender-900">{remainingCount}</span>
            <span className="text-lavender-500">{t('plan.remaining')}</span>
          </div>
          <div className="ms-auto">
            <ProgressBar value={completedCount} max={tasks.length} className="w-32" />
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={<ListChecks size={40} />}
            title={t('plan.noTasks')}
            description={t('plan.noTasksDesc')}
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus size={18} />
                {t('plan.createFirst')}
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isExpanded = expandedSteps.has(task.id);
            const steps = taskSteps[task.id] ?? [];
            const completedSteps = steps.filter((s) => s.completed).length;
            return (
              <div key={task.id} className="card group">
                <div className="flex items-center gap-3 p-4">
                  <button
                    onClick={() => handleToggle(task)}
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      task.status === 'completed'
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-lavender-300 text-lavender-400 hover:border-lavender-500 hover:text-lavender-600'
                    }`}
                    title={task.status === 'completed' ? t('plan.markPending') : t('plan.markComplete')}
                  >
                    {task.status === 'completed' && <CheckCircle2 size={14} />}
                    {task.status !== 'completed' && <Circle size={14} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-semibold ${task.status === 'completed' ? 'text-lavender-400 line-through' : 'text-lavender-900'}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="mt-0.5 truncate text-xs text-lavender-500">{task.description}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-lavender-400">
                      {task.subject_name && (
                        <span className="flex items-center gap-1">
                          <BookOpen size={12} /> {task.subject_name}
                        </span>
                      )}
                      {task.planned_duration && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {task.planned_duration} {t('common.minShort')}
                        </span>
                      )}
                      {task.carried_forward && <Badge variant="info">{t('plan.carryForward')}</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      onClick={() => toggleExpand(task.id)}
                      className="rounded-lg p-2 text-lavender-400 transition-colors hover:bg-lavender-50 hover:text-lavender-600"
                      title={t('plan.steps')}
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <button
                      onClick={() => openEdit(task)}
                      className="rounded-lg p-2 text-lavender-400 transition-colors hover:bg-lavender-50 hover:text-lavender-600"
                      title={t('common.edit')}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(task)}
                      className="rounded-lg p-2 text-lavender-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title={t('common.delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-lavender-50 px-4 py-3">
                    {task.step_count > 0 && (
                      <div className="mb-2 flex items-center gap-2 text-xs text-lavender-500">
                        <ListChecks size={14} />
                        {completedSteps}/{task.step_count} {t('plan.stepsProgress')}
                      </div>
                    )}
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
                            onClick={() => handleDeleteStep(step.id, task.id)}
                            className="text-lavender-300 opacity-0 transition-opacity hover:text-red-500 group-hover/step:opacity-100"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={stepInputs[task.id] ?? ''}
                        onChange={(e) => setStepInputs((prev) => ({ ...prev, [task.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddStep(task.id)}
                        className="input-field !py-2 text-sm"
                        placeholder={t('plan.stepPlaceholder')}
                      />
                      <button
                        onClick={() => handleAddStep(task.id)}
                        className="btn-ghost !px-3 !py-2"
                        disabled={!stepInputs[task.id]?.trim()}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingTask ? t('plan.edit') : t('plan.addTask')}>
        <div className="space-y-4">
          <div>
            <label className="label-text">{t('plan.taskTitle')}</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text">{t('plan.taskDesc')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field min-h-[60px] resize-y"
            />
          </div>
          <div>
            <label className="label-text">{t('plan.plannedDate')}</label>
            <input
              type="date"
              required
              value={form.planned_date}
              onChange={(e) => setForm({ ...form, planned_date: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text">{t('plan.plannedDuration')}</label>
            <input
              type="number"
              min="1"
              value={form.planned_duration}
              onChange={(e) => setForm({ ...form, planned_duration: e.target.value })}
              className="input-field"
              placeholder="60"
            />
          </div>
          <div>
            <label className="label-text">{t('common.learningPath')}</label>
            <select
              value={form.learning_path_id}
              onChange={(e) => setForm({ ...form, learning_path_id: e.target.value, subject_id: '', lesson_id: '' })}
              className="input-field"
            >
              <option value="">{t('common.none')}</option>
              {learningPaths.map((lp) => (
                <option key={lp.id} value={lp.id}>{lp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-text">{t('common.subject')}</label>
            <select
              value={form.subject_id}
              onChange={(e) => setForm({ ...form, subject_id: e.target.value, lesson_id: '' })}
              className="input-field"
            >
              <option value="">{t('common.none')}</option>
              {filteredSubjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-text">{t('common.lesson')}</label>
            <select
              value={form.lesson_id}
              onChange={(e) => setForm({ ...form, lesson_id: e.target.value })}
              className="input-field"
              disabled={!form.subject_id}
            >
              <option value="">{t('common.none')}</option>
              {filteredLessons.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} disabled={saving || !form.title.trim()} className="btn-primary">
              {saving ? <Spinner size={18} /> : editingTask ? t('plan.save') : t('plan.create')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title={t('plan.delete')}
        message={t('plan.deleteConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
      />
    </div>
  );
}
