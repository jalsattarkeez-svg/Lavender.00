import { useEffect, useState } from 'react';
import {
  fetchLearningPaths,
  createLearningPath,
  updateLearningPath,
  deleteLearningPath,
} from '@/lib/api';
import type { LearningPathWithCounts } from '@/types/database';
import { Spinner, EmptyState, ErrorMessage } from '@/components/ui/Feedback';
import { Modal, ConfirmDialog, ProgressBar, Badge } from '@/components/ui/ConfirmDialog';
import { Plus, BookOpen, Pencil, Trash2, ChevronRight, Sparkles } from 'lucide-react';
import { useT } from '@/lib/i18n';

interface LearningPathFormState {
  name: string;
  description: string;
  icon: string;
}

const iconOptions = ['📚', '💻', '🔐', '🎓', '🧠', '🚀', '🎨', '🧪', '📖', '⭐'];

export function LearningPathList({
  onOpen,
}: {
  onOpen: (path: LearningPathWithCounts) => void;
}) {
  const t = useT();
  const [paths, setPaths] = useState<LearningPathWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LearningPathWithCounts | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LearningPathWithCounts | null>(null);
  const [form, setForm] = useState<LearningPathFormState>({ name: '', description: '', icon: '📚' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLearningPaths();
      setPaths(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load learning paths');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ name: '', description: '', icon: '📚' });
    setModalOpen(true);
  };

  const openEdit = (path: LearningPathWithCounts) => {
    setEditTarget(path);
    setForm({ name: path.name, description: path.description ?? '', icon: path.icon ?? '📚' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editTarget) {
        await updateLearningPath(editTarget.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          icon: form.icon,
        });
      } else {
        await createLearningPath(form.name.trim(), form.description.trim() || null, form.icon);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save learning path');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (path: LearningPathWithCounts) => {
    try {
      await deleteLearningPath(path.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete learning path');
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-lavender-900">{t('learning.paths')}</h2>
          <p className="text-sm text-lavender-500">{t('learning.subtitle')}</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} />
          {t('learning.addPath')}
        </button>
      </div>

      {error && (
        <ErrorMessage message={error} />
      )}

      {paths.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={<BookOpen size={40} />}
            title={t('learning.noPaths')}
            description={t('learning.noPathsDesc')}
            action={
              <button onClick={openCreate} className="btn-primary">
                <Sparkles size={18} />
                {t('learning.createPath')}
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paths.map((path) => (
            <div
              key={path.id}
              className="card group flex flex-col p-4 transition-all hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-lavender-100 text-2xl">
                  {path.icon || '📚'}
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(path)}
                    className="rounded-lg p-1.5 text-lavender-400 hover:bg-lavender-100 hover:text-lavender-600"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(path)}
                    className="rounded-lg p-1.5 text-lavender-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <button
                onClick={() => onOpen(path)}
                className="flex-1 text-left"
              >
                <h3 className="font-semibold text-lavender-900 group-hover:text-lavender-700">
                  {path.name}
                </h3>
                {path.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-lavender-500">{path.description}</p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="default">{path.subject_count} {t('learning.subjectsCount')}</Badge>
                </div>
              </button>
              <button
                onClick={() => onOpen(path)}
                className="mt-3 flex items-center gap-1 text-sm font-medium text-lavender-600 hover:text-lavender-700"
              >
                Open <ChevronRight size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? t('learning.editPath') : t('learning.addPath')}
      >
        <div className="space-y-4">
          <div>
            <label className="label-text" htmlFor="lp-name">{t('learning.pathName')}</label>
            <input
              id="lp-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
              placeholder="e.g. University, Programming"
            />
          </div>
          <div>
            <label className="label-text" htmlFor="lp-desc">{t('common.description')} <span className="text-lavender-300">{t('common.optional')}</span></label>
            <textarea
              id="lp-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-field min-h-[80px] resize-y"
              placeholder="What is this learning path about?"
            />
          </div>
          <div>
            <label className="label-text">Icon</label>
            <div className="flex flex-wrap gap-2">
              {iconOptions.map((icon) => (
                <button
                  key={icon}
                  onClick={() => setForm({ ...form, icon })}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-all ${
                    form.icon === icon
                      ? 'bg-lavender-200 ring-2 ring-lavender-500'
                      : 'bg-lavender-50 hover:bg-lavender-100'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="btn-primary">
              {saving ? <Spinner size={18} /> : editTarget ? t('learning.saveChanges') : t('learning.createPath')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title={t('learning.deletePath')}
        message={`Delete "${deleteTarget?.name}" and all its subjects and lessons? ${t('learning.deleteConfirm')}`}
        confirmLabel={t('common.delete')}
        destructive
      />
    </div>
  );
}
