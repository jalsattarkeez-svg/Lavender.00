import { useEffect, useState, useCallback } from 'react';
import {
  fetchGoalsWithProgress, createGoal, updateGoal, deleteGoal, fetchAllSubjects,
} from '@/lib/api';
import type { GoalType, GoalWithProgress, SubjectWithProgress } from '@/types/database';
import { formatDuration, formatDurationShort } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { Spinner, EmptyState, ErrorMessage } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog, Badge, ProgressBar } from '@/components/ui/ConfirmDialog';
import { Target, Plus, Pencil, Trash2, Clock, CheckCircle2, CalendarClock, GraduationCap, TrendingUp, BookOpen, AlertCircle } from 'lucide-react';

function todayLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function defaultEndDateForType(type: GoalType): string {
  if (type === 'daily_effective_time') return todayLocalDate();
  if (type === 'weekly_effective_time') return addDaysISO(6);
  if (type === 'monthly_effective_time') return addDaysISO(29);
  return addDaysISO(7);
}

export function GoalsPage() {
  const t = useT();
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [subjects, setSubjects] = useState<SubjectWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalWithProgress | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GoalWithProgress | null>(null);

  const goalTypeConfig: Record<GoalType, { label: string; unit: string; icon: typeof Clock; needsSubject: boolean }> = {
    daily_effective_time: { label: t('goals.dailyEffective'), unit: t('goals.unitMinutes'), icon: Clock, needsSubject: false },
    weekly_effective_time: { label: t('goals.weeklyEffective'), unit: t('goals.unitMinutes'), icon: CalendarClock, needsSubject: false },
    monthly_effective_time: { label: t('goals.monthlyEffective'), unit: t('goals.unitMinutes'), icon: CalendarClock, needsSubject: false },
    subject_effective_time: { label: t('goals.subjectEffective'), unit: t('goals.unitMinutes'), icon: GraduationCap, needsSubject: true },
    lessons_completed: { label: t('goals.lessonsCompleted'), unit: t('goals.unitLessons'), icon: BookOpen, needsSubject: false },
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [g, subs] = await Promise.all([fetchGoalsWithProgress(), fetchAllSubjects()]);
      setGoals(g);
      setSubjects(subs);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const activeGoals = goals.filter((g) => g.status === 'active');
  const completedGoals = goals.filter((g) => g.status === 'completed');
  const expiredGoals = goals.filter((g) => g.status === 'expired');

  const handleSaved = async () => { setShowForm(false); setEditingGoal(null); await load(); };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await deleteGoal(deleteTarget.id); setDeleteTarget(null); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : t('common.error')); }
  };

  const formatProgressValue = (value: number, unit: string) => unit === t('goals.unitMinutes') ? formatDuration(value * 60) : String(Math.round(value));
  const formatRemainingValue = (value: number, unit: string) => unit === t('goals.unitMinutes') ? formatDurationShort(value * 60) : String(Math.round(value));

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Spinner size={36} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-lavender-900">{t('goals.title')}</h1>
          <p className="mt-1 text-sm text-lavender-500">{t('goals.subtitle')}</p>
        </div>
        <button onClick={() => { setEditingGoal(null); setShowForm(true); }} className="btn-primary">
          <Plus size={18} />{t('goals.create')}
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {goals.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={<Target size={40} />}
            title={t('goals.noGoals')}
            description={t('goals.noGoalsDesc')}
            action={<button onClick={() => { setEditingGoal(null); setShowForm(true); }} className="btn-primary"><Plus size={18} />{t('goals.createFirst')}</button>}
          />
        </div>
      ) : (
        <>
          <GoalSection title={t('goals.active')} icon={Target} goals={activeGoals} subjects={subjects} goalTypeConfig={goalTypeConfig} formatProgressValue={formatProgressValue} formatRemainingValue={formatRemainingValue} t={t}
            onEdit={(g) => { setEditingGoal(g); setShowForm(true); }} onDelete={(g) => setDeleteTarget(g)} />
          {completedGoals.length > 0 && (
            <GoalSection title={t('goals.completed')} icon={CheckCircle2} goals={completedGoals} subjects={subjects} goalTypeConfig={goalTypeConfig} formatProgressValue={formatProgressValue} formatRemainingValue={formatRemainingValue} t={t}
              onEdit={(g) => { setEditingGoal(g); setShowForm(true); }} onDelete={(g) => setDeleteTarget(g)} />
          )}
          {expiredGoals.length > 0 && (
            <GoalSection title={t('goals.expired')} icon={AlertCircle} goals={expiredGoals} subjects={subjects} goalTypeConfig={goalTypeConfig} formatProgressValue={formatProgressValue} formatRemainingValue={formatRemainingValue} t={t}
              onEdit={(g) => { setEditingGoal(g); setShowForm(true); }} onDelete={(g) => setDeleteTarget(g)} />
          )}
        </>
      )}

      <GoalFormModal open={showForm} onClose={() => { setShowForm(false); setEditingGoal(null); }} onSave={handleSaved} subjects={subjects} editingGoal={editingGoal} t={t} goalTypeConfig={goalTypeConfig} />

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title={t('goals.delete')} message={t('goals.deleteConfirm')} confirmLabel={t('common.delete')} cancelLabel={t('common.cancel')} destructive />
    </div>
  );
}

function GoalSection({ title, icon: Icon, goals, subjects, goalTypeConfig, formatProgressValue, formatRemainingValue, t, onEdit, onDelete }: {
  title: string; icon: typeof Target; goals: GoalWithProgress[]; subjects: SubjectWithProgress[];
  goalTypeConfig: Record<GoalType, { label: string; unit: string; icon: typeof Clock; needsSubject: boolean }>;
  formatProgressValue: (v: number, u: string) => string; formatRemainingValue: (v: number, u: string) => string;
  t: (k: string) => string; onEdit: (g: GoalWithProgress) => void; onDelete: (g: GoalWithProgress) => void;
}) {
  if (goals.length === 0) return null;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Icon size={20} className="text-lavender-600" />
        <h2 className="text-lg font-semibold text-lavender-900">{title}</h2>
        <Badge variant="default">{goals.length}</Badge>
      </div>
      <div className="space-y-3">
        {goals.map((goal) => {
          const config = goalTypeConfig[goal.goal_type];
          const GoalIcon = config.icon;
          return (
            <div key={goal.id} className="card group p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-lavender-100">
                  <GoalIcon size={22} className="text-lavender-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-lavender-900">{goal.title || config.label}</p>
                    {goal.status === 'completed' && <Badge variant="success">{t('goals.completed2')}</Badge>}
                    {goal.status === 'expired' && <Badge variant="warning">{t('goals.expired2')}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-lavender-500">
                    {goal.subject_name && `${goal.subject_name} · `}
                    {goal.start_date} → {goal.end_date}
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <ProgressBar value={goal.percentage} className="flex-1" />
                    <span className="text-sm font-bold text-lavender-900">{goal.percentage}%</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-lavender-500">
                    <span>{t('goals.progress')}: <span className="font-medium text-lavender-700">{formatProgressValue(goal.current_value, config.unit)}</span></span>
                    <span>{t('goals.target')}: <span className="font-medium text-lavender-700">{formatProgressValue(goal.target_value, config.unit)}</span></span>
                    {goal.remaining > 0 && goal.status === 'active' && (
                      <span>{t('goals.remaining')}: <span className="font-medium text-lavender-700">{formatRemainingValue(goal.remaining, config.unit)}</span></span>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 gap-1">
                  <button onClick={() => onEdit(goal)} className="rounded-lg p-2 text-lavender-400 hover:bg-lavender-50 hover:text-lavender-600" title={t('common.edit')}><Pencil size={16} /></button>
                  <button onClick={() => onDelete(goal)} className="rounded-lg p-2 text-lavender-400 hover:bg-red-50 hover:text-red-600" title={t('common.delete')}><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalFormModal({ open, onClose, onSave, subjects, editingGoal, t, goalTypeConfig }: {
  open: boolean; onClose: () => void; onSave: () => void; subjects: SubjectWithProgress[];
  editingGoal: GoalWithProgress | null; t: (k: string) => string;
  goalTypeConfig: Record<GoalType, { label: string; unit: string; icon: typeof Clock; needsSubject: boolean }>;
}) {
  const [title, setTitle] = useState('');
  const [goalType, setGoalType] = useState<GoalType>('daily_effective_time');
  const [targetValue, setTargetValue] = useState('60');
  const [subjectId, setSubjectId] = useState('');
  const [startDate, setStartDate] = useState(todayLocalDate());
  const [endDate, setEndDate] = useState(defaultEndDateForType('daily_effective_time'));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (editingGoal) {
        setTitle(editingGoal.title || '');
        setGoalType(editingGoal.goal_type);
        setTargetValue(String(editingGoal.target_value));
        setSubjectId(editingGoal.subject_id || '');
        setStartDate(editingGoal.start_date);
        setEndDate(editingGoal.end_date);
      } else {
        setTitle(''); setGoalType('daily_effective_time'); setTargetValue('60');
        setSubjectId(''); setStartDate(todayLocalDate()); setEndDate(defaultEndDateForType('daily_effective_time'));
      }
      setFormError(null);
    }
  }, [open, editingGoal]);

  const config = goalTypeConfig[goalType];
  const isTimeGoal = goalType.endsWith('_effective_time');

  const handleTypeChange = (type: GoalType) => {
    setGoalType(type);
    if (!editingGoal) {
      setEndDate(defaultEndDateForType(type));
      setTargetValue(type === 'lessons_completed' ? '5' : '60');
    }
    if (!goalTypeConfig[type].needsSubject) setSubjectId('');
  };

  const handleSubmit = async () => {
    setFormError(null);
    const numTarget = parseFloat(targetValue);
    if (isNaN(numTarget) || numTarget <= 0) { setFormError(`${t('goals.target')} ${t('common.required')}`); return; }
    if (config.needsSubject && !subjectId) { setFormError(`${t('common.subject')} ${t('common.required')}`); return; }
    if (new Date(endDate) < new Date(startDate)) { setFormError(`${t('goals.endDate')} < ${t('goals.startDate')}`); return; }
    const storedValue = isTimeGoal ? numTarget * 60 : numTarget;
    setSaving(true);
    try {
      if (editingGoal) {
        await updateGoal(editingGoal.id, { title: title.trim() || null, goal_type: goalType, target_value: storedValue, subject_id: config.needsSubject ? subjectId : null, start_date: startDate, end_date: endDate });
      } else {
        await createGoal({ title: title.trim() || null, goal_type: goalType, target_value: storedValue, subject_id: config.needsSubject ? subjectId : null, start_date: startDate, end_date: endDate });
      }
      onSave();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editingGoal ? t('goals.edit') : t('goals.create')} maxWidth="max-w-lg">
      <div className="space-y-4">
        {formError && <ErrorMessage message={formError} />}
        <div>
          <label className="label-text">{t('goals.titleOptional')}</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder={t('goals.titlePlaceholder')} />
        </div>
        <div>
          <label className="label-text">{t('goals.type')}</label>
          <select value={goalType} onChange={(e) => handleTypeChange(e.target.value as GoalType)} className="input-field">
            {Object.entries(goalTypeConfig).map(([value, cfg]) => (<option key={value} value={value}>{cfg.label}</option>))}
          </select>
        </div>
        <div>
          <label className="label-text">{t('goals.target')} ({config.unit})</label>
          <input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="input-field" min="1" step={isTimeGoal ? '5' : '1'} />
        </div>
        {config.needsSubject && (
          <div>
            <label className="label-text">{t('common.subject')}</label>
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="input-field">
              <option value="">{t('goals.selectSubject')}</option>
              {subjects.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-text">{t('goals.startDate')}</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="label-text">{t('goals.endDate')}</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary">
            {saving ? <Spinner size={18} /> : editingGoal ? t('goals.save') : t('goals.create')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
