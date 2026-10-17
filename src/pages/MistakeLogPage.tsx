import { useState, useEffect, useCallback } from 'react';
import {
  fetchMistakes,
  createMistake,
  updateMistake,
  deleteMistake,
  fetchAllSubjects,
  fetchLessons,
} from '@/lib/api';
import type { MistakeWithNames, SubjectWithProgress, MistakeCategory, MistakeStatus } from '@/types/database';
import { useT } from '@/lib/i18n';
import { Spinner, EmptyState, ErrorMessage } from '@/components/ui/Feedback';
import { Modal, ConfirmDialog, Badge } from '@/components/ui/ConfirmDialog';
import { Plus, Pencil, Trash2, AlertCircle, BookOpen, CheckCircle2, Circle, Filter } from 'lucide-react';

const CATEGORIES: MistakeCategory[] = ['conceptual', 'formula', 'calculation', 'misreading', 'forgotten', 'other'];

interface MistakeFormState {
  title: string;
  category: MistakeCategory;
  subject_id: string;
  lesson_id: string;
  topic: string;
  explanation: string;
  correct_approach: string;
  follow_up_date: string;
}

export function MistakeLogPage() {
  const t = useT();
  const [mistakes, setMistakes] = useState<MistakeWithNames[]>([]);
  const [subjects, setSubjects] = useState<SubjectWithProgress[]>([]);
  const [lessons, setLessons] = useState<{ id: string; title: string; subject_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMistake, setEditingMistake] = useState<MistakeWithNames | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MistakeWithNames | null>(null);
  const [form, setForm] = useState<MistakeFormState>({
    title: '', category: 'conceptual', subject_id: '', lesson_id: '',
    topic: '', explanation: '', correct_approach: '', follow_up_date: '',
  });
  const [saving, setSaving] = useState(false);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mistakeData, subData] = await Promise.all([
        fetchMistakes(),
        fetchAllSubjects(),
      ]);
      setMistakes(mistakeData);
      setSubjects(subData);
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

  const openCreate = () => {
    setEditingMistake(null);
    setForm({
      title: '', category: 'conceptual', subject_id: '', lesson_id: '',
      topic: '', explanation: '', correct_approach: '', follow_up_date: '',
    });
    setModalOpen(true);
  };

  const openEdit = (mistake: MistakeWithNames) => {
    setEditingMistake(mistake);
    setForm({
      title: mistake.title,
      category: mistake.category,
      subject_id: mistake.subject_id ?? '',
      lesson_id: mistake.lesson_id ?? '',
      topic: mistake.topic ?? '',
      explanation: mistake.explanation ?? '',
      correct_approach: mistake.correct_approach ?? '',
      follow_up_date: mistake.follow_up_date ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const params = {
        title: form.title.trim(),
        category: form.category,
        subject_id: form.subject_id || null,
        lesson_id: form.lesson_id || null,
        topic: form.topic.trim() || null,
        explanation: form.explanation.trim() || null,
        correct_approach: form.correct_approach.trim() || null,
        follow_up_date: form.follow_up_date || null,
      };
      if (editingMistake) {
        await updateMistake(editingMistake.id, params);
      } else {
        await createMistake(params);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (mistake: MistakeWithNames) => {
    try {
      await updateMistake(mistake.id, {
        status: mistake.status === 'resolved' ? 'unresolved' : 'resolved',
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleDelete = async (mistake: MistakeWithNames) => {
    try {
      await deleteMistake(mistake.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const filteredLessons = form.subject_id
    ? lessons.filter((l) => l.subject_id === form.subject_id)
    : [];

  const filteredMistakes = mistakes.filter((m) => {
    if (filterSubject && m.subject_id !== filterSubject) return false;
    if (filterCategory && m.category !== filterCategory) return false;
    if (filterStatus && m.status !== filterStatus) return false;
    return true;
  });

  const unresolvedCount = mistakes.filter((m) => m.status === 'unresolved').length;
  const resolvedCount = mistakes.filter((m) => m.status === 'resolved').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={36} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-lavender-900">{t('mistakes.title')}</h1>
          <p className="mt-1 text-sm text-lavender-500">{t('mistakes.subtitle')}</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} />
          {t('mistakes.add')}
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {mistakes.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-lavender-100 bg-white px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle size={18} className="text-amber-600" />
            <span className="font-medium text-lavender-900">{unresolvedCount}</span>
            <span className="text-lavender-500">{t('mistakes.unresolvedCount')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 size={18} className="text-green-600" />
            <span className="font-medium text-lavender-900">{resolvedCount}</span>
            <span className="text-lavender-500">{t('mistakes.resolvedCount')}</span>
          </div>
        </div>
      )}

      {mistakes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={16} className="text-lavender-400" />
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="input-field !py-2 !w-auto text-sm"
          >
            <option value="">{t('mistakes.filterBySubject')}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="input-field !py-2 !w-auto text-sm"
          >
            <option value="">{t('mistakes.filterByCategory')}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(`mistakes.${c}`)}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-field !py-2 !w-auto text-sm"
          >
            <option value="">{t('mistakes.filterByStatus')}</option>
            <option value="unresolved">{t('mistakes.unresolved')}</option>
            <option value="resolved">{t('mistakes.resolved')}</option>
          </select>
        </div>
      )}

      {mistakes.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={<AlertCircle size={40} />}
            title={t('mistakes.noMistakes')}
            description={t('mistakes.noMistakesDesc')}
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus size={18} />
                {t('mistakes.createFirst')}
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMistakes.map((mistake) => (
            <div key={mistake.id} className="card group p-4">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => handleToggleStatus(mistake)}
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors mt-0.5 ${
                    mistake.status === 'resolved'
                      ? 'border-green-500 bg-green-500 text-white'
                      : 'border-amber-400 text-amber-400 hover:border-amber-600 hover:text-amber-600'
                  }`}
                  title={mistake.status === 'resolved' ? t('mistakes.markUnresolved') : t('mistakes.markResolved')}
                >
                  {mistake.status === 'resolved' ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${mistake.status === 'resolved' ? 'text-lavender-400 line-through' : 'text-lavender-900'}`}>
                    {mistake.title}
                  </p>
                  {mistake.topic && (
                    <p className="mt-0.5 text-xs text-lavender-500">{mistake.topic}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-lavender-400">
                    {mistake.subject_name && (
                      <span className="flex items-center gap-1">
                        <BookOpen size={12} /> {mistake.subject_name}
                      </span>
                    )}
                    <Badge variant={mistake.status === 'resolved' ? 'success' : 'warning'}>
                      {t(`mistakes.${mistake.category}`)}
                    </Badge>
                    {mistake.follow_up_date && (
                      <span>· {t('mistakes.followUpDate')}: {mistake.follow_up_date}</span>
                    )}
                  </div>
                  {mistake.explanation && (
                    <p className="mt-2 text-sm text-lavender-600">
                      <span className="font-medium">{t('mistakes.explanation')}: </span>{mistake.explanation}
                    </p>
                  )}
                  {mistake.correct_approach && (
                    <p className="mt-1 text-sm text-green-700">
                      <span className="font-medium">{t('mistakes.correctApproach')}: </span>{mistake.correct_approach}
                    </p>
                  )}
                </div>
                <div className="flex flex-shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(mistake)}
                    className="rounded-lg p-2 text-lavender-400 hover:bg-lavender-50 hover:text-lavender-600"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(mistake)}
                    className="rounded-lg p-2 text-lavender-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingMistake ? t('mistakes.edit') : t('mistakes.add')} maxWidth="max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="label-text">{t('mistakes.mistakeTitle')}</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-text">{t('mistakes.category')}</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as MistakeCategory })}
                className="input-field"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t(`mistakes.${c}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-text">{t('mistakes.followUpDate')}</label>
              <input
                type="date"
                value={form.follow_up_date}
                onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="label-text">{t('mistakes.subject')}</label>
            <select
              value={form.subject_id}
              onChange={(e) => setForm({ ...form, subject_id: e.target.value, lesson_id: '' })}
              className="input-field"
            >
              <option value="">{t('common.none')}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-text">{t('mistakes.lesson')}</label>
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
          <div>
            <label className="label-text">{t('mistakes.topic')}</label>
            <input
              type="text"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text">{t('mistakes.explanation')}</label>
            <textarea
              value={form.explanation}
              onChange={(e) => setForm({ ...form, explanation: e.target.value })}
              className="input-field min-h-[60px] resize-y"
            />
          </div>
          <div>
            <label className="label-text">{t('mistakes.correctApproach')}</label>
            <textarea
              value={form.correct_approach}
              onChange={(e) => setForm({ ...form, correct_approach: e.target.value })}
              className="input-field min-h-[60px] resize-y"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} disabled={saving || !form.title.trim()} className="btn-primary">
              {saving ? <Spinner size={18} /> : editingMistake ? t('mistakes.save') : t('mistakes.create')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title={t('mistakes.delete')}
        message={t('mistakes.deleteConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
      />
    </div>
  );
}
