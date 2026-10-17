import { useEffect, useState } from 'react';
import {
  fetchSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
} from '@/lib/api';
import type { LearningPathWithCounts, SubjectWithProgress } from '@/types/database';
import { Spinner, EmptyState, ErrorMessage } from '@/components/ui/Feedback';
import { Modal, ConfirmDialog, ProgressBar, Badge } from '@/components/ui/ConfirmDialog';
import { Plus, GraduationCap, Pencil, Trash2, ChevronRight, ArrowLeft, Calendar } from 'lucide-react';
import { useT } from '@/lib/i18n';

interface SubjectFormState {
  name: string;
  description: string;
  start_date: string;
  end_date: string;
}

export function SubjectList({
  learningPath,
  onOpen,
  onBack,
}: {
  learningPath: LearningPathWithCounts;
  onOpen: (subject: SubjectWithProgress) => void;
  onBack: () => void;
}) {
  const t = useT();
  const [subjects, setSubjects] = useState<SubjectWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SubjectWithProgress | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubjectWithProgress | null>(null);
  const [form, setForm] = useState<SubjectFormState>({ name: '', description: '', start_date: '', end_date: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSubjects(learningPath.id);
      setSubjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [learningPath.id]);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ name: '', description: '', start_date: '', end_date: '' });
    setModalOpen(true);
  };

  const openEdit = (subject: SubjectWithProgress) => {
    setEditTarget(subject);
    setForm({
      name: subject.name,
      description: subject.description ?? '',
      start_date: subject.start_date ?? '',
      end_date: subject.end_date ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editTarget) {
        await updateSubject(editTarget.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
        });
      } else {
        await createSubject(
          learningPath.id,
          form.name.trim(),
          form.description.trim() || null,
          form.start_date || null,
          form.end_date || null
        );
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save subject');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (subject: SubjectWithProgress) => {
    try {
      await deleteSubject(subject.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete subject');
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
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-lavender-100 text-3xl">
            {learningPath.icon || '📚'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-lavender-900">{learningPath.name}</h2>
            {learningPath.description && (
              <p className="mt-0.5 text-sm text-lavender-500">{learningPath.description}</p>
            )}
          </div>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} />
          {t('learning.addSubject')}
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {subjects.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={<GraduationCap size={40} />}
            title={t('learning.noSubjects')}
            description={t('learning.noSubjectsDesc')}
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus size={18} />
                {t('learning.addSubject')}
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {subjects.map((subject) => {
            const progress =
              subject.lesson_count > 0
                ? Math.round((subject.completed_lessons / subject.lesson_count) * 100)
                : 0;
            return (
              <div
                key={subject.id}
                className="card group flex items-center gap-4 p-4 transition-all hover:shadow-md"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-lavender-100">
                  <GraduationCap size={22} className="text-lavender-600" />
                </div>
                <button
                  onClick={() => onOpen(subject)}
                  className="min-w-0 flex-1 text-left"
                >
                  <h3 className="font-semibold text-lavender-900 group-hover:text-lavender-700">
                    {subject.name}
                  </h3>
                  {subject.description && (
                    <p className="mt-0.5 line-clamp-1 text-sm text-lavender-500">{subject.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3">
                    <ProgressBar value={progress} className="max-w-[160px]" />
                    <span className="text-xs text-lavender-500">
                      {subject.completed_lessons}/{subject.lesson_count} {t('learning.lessonsCount')}
                    </span>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <Badge variant={progress === 100 ? 'success' : progress > 0 ? 'info' : 'default'}>
                    {progress}%
                  </Badge>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(subject)}
                      className="rounded-lg p-1.5 text-lavender-400 hover:bg-lavender-100 hover:text-lavender-600"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(subject)}
                      className="rounded-lg p-1.5 text-lavender-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <button
                    onClick={() => onOpen(subject)}
                    className="rounded-lg p-1.5 text-lavender-400 hover:bg-lavender-100 hover:text-lavender-600"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? t('learning.editSubject') : t('learning.addSubject')}
      >
        <div className="space-y-4">
          <div>
            <label className="label-text" htmlFor="subj-name">{t('learning.subjectName')}</label>
            <input
              id="subj-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
              placeholder="e.g. Calculus, React Basics"
            />
          </div>
          <div>
            <label className="label-text" htmlFor="subj-desc">{t('common.description')} <span className="text-lavender-300">{t('common.optional')}</span></label>
            <textarea
              id="subj-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field min-h-[80px] resize-y"
              placeholder="What does this subject cover?"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-text" htmlFor="subj-start">{t('learning.startDate')}</label>
              <input
                id="subj-start"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text" htmlFor="subj-end">{t('learning.endDate')}</label>
              <input
                id="subj-end"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary">
              {saving ? <Spinner size={18} /> : editTarget ? t('learning.saveChanges') : t('learning.addSubject')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title={t('learning.deleteSubject')}
        message={`Delete "${deleteTarget?.name}" and all its lessons? ${t('learning.deleteConfirm')}`}
        confirmLabel={t('common.delete')}
        destructive
      />
    </div>
  );
}
