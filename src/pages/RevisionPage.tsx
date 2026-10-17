import { useState, useEffect, useCallback } from 'react';
import {
  fetchReviews,
  createReview,
  updateReview,
  deleteReview,
  fetchAllSubjects,
  fetchLessons,
} from '@/lib/api';
import type { ReviewWithNames, SubjectWithProgress, ReviewStatus, ReviewConfidence } from '@/types/database';
import { useT } from '@/lib/i18n';
import { Spinner, EmptyState, ErrorMessage } from '@/components/ui/Feedback';
import { Modal, ConfirmDialog, Badge } from '@/components/ui/ConfirmDialog';
import { Plus, Pencil, Trash2, CalendarClock, CheckCircle2, BookOpen, AlertCircle } from 'lucide-react';

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

interface ReviewFormState {
  title: string;
  review_date: string;
  subject_id: string;
  lesson_id: string;
}

export function RevisionPage() {
  const t = useT();
  const [reviews, setReviews] = useState<ReviewWithNames[]>([]);
  const [subjects, setSubjects] = useState<SubjectWithProgress[]>([]);
  const [lessons, setLessons] = useState<{ id: string; title: string; subject_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<ReviewWithNames | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReviewWithNames | null>(null);
  const [form, setForm] = useState<ReviewFormState>({
    title: '', review_date: todayLocalDate(), subject_id: '', lesson_id: '',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reviewData, subData] = await Promise.all([
        fetchReviews(),
        fetchAllSubjects(),
      ]);
      setReviews(reviewData);
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

  const todayStr = todayLocalDate();
  const dueToday = reviews.filter((r) => r.status === 'pending' && r.review_date <= todayStr);
  const upcoming = reviews.filter((r) => r.status === 'pending' && r.review_date > todayStr);
  const completed = reviews.filter((r) => r.status === 'completed' || r.status === 'skipped' || r.status === 'cancelled');

  const openCreate = () => {
    setEditingReview(null);
    setForm({ title: '', review_date: todayLocalDate(), subject_id: '', lesson_id: '' });
    setModalOpen(true);
  };

  const openEdit = (review: ReviewWithNames) => {
    setEditingReview(review);
    setForm({
      title: review.title,
      review_date: review.review_date,
      subject_id: review.subject_id ?? '',
      lesson_id: review.lesson_id ?? '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const params = {
        title: form.title.trim(),
        review_date: form.review_date,
        subject_id: form.subject_id || null,
        lesson_id: form.lesson_id || null,
      };
      if (editingReview) {
        await updateReview(editingReview.id, params);
      } else {
        await createReview(params);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (review: ReviewWithNames, status: ReviewStatus, confidence?: ReviewConfidence) => {
    try {
      const updates: Parameters<typeof updateReview>[1] = { status };
      if (confidence) updates.confidence = confidence;
      if (status === 'completed') {
        const today = todayLocalDate();
        const next = new Date();
        next.setDate(next.getDate() + (confidence === 'difficult' ? 1 : confidence === 'partial' ? 3 : 7));
        updates.next_review_date = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
        void today;
      }
      await updateReview(review.id, updates);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleReschedule = async (review: ReviewWithNames, days: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);
    const newDateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
    try {
      await updateReview(review.id, { review_date: newDateStr, status: 'pending' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const handleDelete = async (review: ReviewWithNames) => {
    try {
      await deleteReview(review.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const filteredLessons = form.subject_id
    ? lessons.filter((l) => l.subject_id === form.subject_id)
    : [];

  const statusBadge = (review: ReviewWithNames) => {
    if (review.status === 'completed') return <Badge variant="success">{t('revision.completed')}</Badge>;
    if (review.status === 'skipped') return <Badge variant="default">{t('revision.skipped')}</Badge>;
    if (review.status === 'cancelled') return <Badge variant="default">{t('revision.cancelled')}</Badge>;
    const days = daysRemaining(review.review_date);
    if (days < 0) return <Badge variant="warning">{t('revision.overdue')}</Badge>;
    if (days === 0) return <Badge variant="warning">{t('revision.dueToday')}</Badge>;
    if (days === 1) return <Badge variant="info">{t('revision.dayLeft')}</Badge>;
    return <Badge variant="info">{days} {t('revision.daysLeft')}</Badge>;
  };

  const renderReviewCard = (review: ReviewWithNames) => (
    <div key={review.id} className="card group flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
        review.status === 'pending' && daysRemaining(review.review_date) < 0
          ? 'bg-amber-100 text-amber-600'
          : 'bg-lavender-100 text-lavender-600'
      }`}>
        <CalendarClock size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-lavender-900">{review.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-lavender-500">
          {review.subject_name && (
            <span className="flex items-center gap-1">
              <BookOpen size={12} /> {review.subject_name}
            </span>
          )}
          {review.lesson_title && <span>· {review.lesson_title}</span>}
          <span>· {review.review_date}</span>
          {review.confidence && (
            <Badge variant={review.confidence === 'understood' ? 'success' : review.confidence === 'partial' ? 'info' : 'warning'}>
              {t(`revision.${review.confidence}`)}
            </Badge>
          )}
        </div>
      </div>
      {statusBadge(review)}
      {review.status === 'pending' && (
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            onClick={() => handleStatusChange(review, 'completed', 'understood')}
            className="rounded-lg p-2 text-lavender-400 transition-colors hover:bg-green-50 hover:text-green-600"
            title={t('revision.markComplete')}
          >
            <CheckCircle2 size={16} />
          </button>
          <button
            onClick={() => handleReschedule(review, 1)}
            className="rounded-lg p-2 text-lavender-400 transition-colors hover:bg-lavender-50 hover:text-lavender-600"
            title={t('revision.nextDay')}
          >
            +1d
          </button>
          <button
            onClick={() => handleStatusChange(review, 'skipped')}
            className="rounded-lg p-2 text-lavender-400 transition-colors hover:bg-lavender-50 hover:text-lavender-600 text-xs"
            title={t('revision.skip')}
          >
            {t('revision.skip')}
          </button>
        </div>
      )}
      <div className="flex flex-shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => openEdit(review)}
          className="rounded-lg p-2 text-lavender-400 hover:bg-lavender-50 hover:text-lavender-600"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => setDeleteTarget(review)}
          className="rounded-lg p-2 text-lavender-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );

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
          <h1 className="text-2xl font-bold text-lavender-900">{t('revision.title')}</h1>
          <p className="mt-1 text-sm text-lavender-500">{t('revision.subtitle')}</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={18} />
          {t('revision.add')}
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {reviews.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={<CalendarClock size={40} />}
            title={t('revision.noReviews')}
            description={t('revision.noReviewsDesc')}
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus size={18} />
                {t('revision.createFirst')}
              </button>
            }
          />
        </div>
      ) : (
        <>
          {dueToday.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <AlertCircle size={20} className="text-amber-600" />
                <h2 className="text-lg font-semibold text-lavender-900">{t('revision.dueToday')} / {t('revision.overdue')}</h2>
                <Badge variant="warning">{dueToday.length}</Badge>
              </div>
              <div className="space-y-3">{dueToday.map(renderReviewCard)}</div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <CalendarClock size={20} className="text-lavender-600" />
                <h2 className="text-lg font-semibold text-lavender-900">{t('revision.upcoming')}</h2>
                <Badge variant="info">{upcoming.length}</Badge>
              </div>
              <div className="space-y-3">{upcoming.map(renderReviewCard)}</div>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 size={20} className="text-green-600" />
                <h2 className="text-lg font-semibold text-lavender-900">{t('revision.completed')}</h2>
                <Badge variant="success">{completed.length}</Badge>
              </div>
              <div className="space-y-3">{completed.map(renderReviewCard)}</div>
            </div>
          )}
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingReview ? t('revision.edit') : t('revision.add')}>
        <div className="space-y-4">
          <div>
            <label className="label-text">{t('revision.reviewTitle')}</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text">{t('revision.reviewDate')}</label>
            <input
              type="date"
              required
              value={form.review_date}
              onChange={(e) => setForm({ ...form, review_date: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text">{t('revision.subject')}</label>
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
            <label className="label-text">{t('revision.lesson')}</label>
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
              {saving ? <Spinner size={18} /> : editingReview ? t('revision.save') : t('revision.create')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title={t('revision.delete')}
        message={t('revision.deleteConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
      />
    </div>
  );
}
