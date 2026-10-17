import { useState, useEffect, useCallback } from 'react';
import {
  fetchScheduleEntries,
  createScheduleEntry,
  updateScheduleEntry,
  deleteScheduleEntry,
  fetchAllSubjects,
} from '@/lib/api';
import type { ScheduleEntryWithNames, SubjectWithProgress, ScheduleEntryType } from '@/types/database';
import { useT } from '@/lib/i18n';
import { Spinner, EmptyState, ErrorMessage } from '@/components/ui/Feedback';
import { Modal, ConfirmDialog, Badge } from '@/components/ui/ConfirmDialog';
import { Plus, Pencil, Trash2, Clock, MapPin, Calendar } from 'lucide-react';

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const DAY_SHORT_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);

interface EntryFormState {
  title: string;
  entry_type: ScheduleEntryType;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
  subject_id: string;
}

export function WeeklyPlannerPage() {
  const t = useT();
  const [entries, setEntries] = useState<ScheduleEntryWithNames[]>([]);
  const [subjects, setSubjects] = useState<SubjectWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ScheduleEntryWithNames | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleEntryWithNames | null>(null);
  const [form, setForm] = useState<EntryFormState>({
    title: '', entry_type: 'class', day_of_week: 0,
    start_time: '09:00', end_time: '10:00', location: '', subject_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [timeError, setTimeError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [entryData, subData] = await Promise.all([
        fetchScheduleEntries(),
        fetchAllSubjects(),
      ]);
      setEntries(entryData);
      setSubjects(subData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = (dayOfWeek?: number) => {
    setEditingEntry(null);
    setForm({
      title: '', entry_type: 'class', day_of_week: dayOfWeek ?? 1,
      start_time: '09:00', end_time: '10:00', location: '', subject_id: '',
    });
    setTimeError(false);
    setModalOpen(true);
  };

  const openEdit = (entry: ScheduleEntryWithNames) => {
    setEditingEntry(entry);
    setForm({
      title: entry.title,
      entry_type: entry.entry_type,
      day_of_week: entry.day_of_week,
      start_time: entry.start_time.slice(0, 5),
      end_time: entry.end_time.slice(0, 5),
      location: entry.location ?? '',
      subject_id: entry.subject_id ?? '',
    });
    setTimeError(false);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    if (form.end_time <= form.start_time) {
      setTimeError(true);
      return;
    }
    setSaving(true);
    try {
      const params = {
        title: form.title.trim(),
        entry_type: form.entry_type,
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: form.end_time,
        location: form.location.trim() || null,
        subject_id: form.subject_id || null,
      };
      if (editingEntry) {
        await updateScheduleEntry(editingEntry.id, params);
      } else {
        await createScheduleEntry(params);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: ScheduleEntryWithNames) => {
    try {
      await deleteScheduleEntry(entry.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
    }
  };

  const timeToMinutes = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  const entriesForDay = (day: number) => entries.filter((e) => e.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time));

  const findGaps = (dayEntries: ScheduleEntryWithNames[]): { start: string; end: string }[] => {
    const gaps: { start: string; end: string }[] = [];
    let lastEnd = 7 * 60;
    for (const entry of dayEntries) {
      const startMin = timeToMinutes(entry.start_time);
      const endMin = timeToMinutes(entry.end_time);
      if (startMin > lastEnd) {
        gaps.push({
          start: `${String(Math.floor(lastEnd / 60)).padStart(2, '0')}:${String(lastEnd % 60).padStart(2, '0')}`,
          end: `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}`,
        });
      }
      lastEnd = Math.max(lastEnd, endMin);
    }
    if (lastEnd < 21 * 60) {
      gaps.push({
        start: `${String(Math.floor(lastEnd / 60)).padStart(2, '0')}:${String(lastEnd % 60).padStart(2, '0')}`,
        end: '21:00',
      });
    }
    return gaps;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-lavender-900">{t('planner.title')}</h1>
          <p className="mt-1 text-sm text-lavender-500">{t('planner.subtitle')}</p>
        </div>
        <button onClick={() => openCreate()} className="btn-primary">
          <Plus size={18} />
          {t('planner.addEntry')}
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {entries.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={<Calendar size={40} />}
            title={t('planner.noEntries')}
            description={t('planner.noEntriesDesc')}
            action={
              <button onClick={() => openCreate()} className="btn-primary">
                <Plus size={18} />
                {t('planner.addEntry')}
              </button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {DAYS.map((day) => {
            const dayEntries = entriesForDay(day);
            const gaps = findGaps(dayEntries);
            if (dayEntries.length === 0) return null;
            return (
              <div key={day} className="card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-lavender-900">{t(`planner.${DAY_KEYS[day]}`)}</h3>
                  <button
                    onClick={() => openCreate(day)}
                    className="rounded-lg p-1.5 text-lavender-400 transition-colors hover:bg-lavender-50 hover:text-lavender-600"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="space-y-2">
                  {dayEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`group flex items-center gap-3 rounded-lg border p-3 ${
                        entry.entry_type === 'class'
                          ? 'border-lavender-100 bg-lavender-50/50'
                          : 'border-blue-100 bg-blue-50/50'
                      }`}
                    >
                      <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                        entry.entry_type === 'class' ? 'bg-lavender-200 text-lavender-700' : 'bg-blue-200 text-blue-700'
                      }`}>
                        <Clock size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-lavender-900">{entry.title}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-lavender-500">
                          <span>{entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}</span>
                          {entry.subject_name && <span>· {entry.subject_name}</span>}
                          {entry.location && (
                            <span className="flex items-center gap-0.5">
                              <MapPin size={10} /> {entry.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant={entry.entry_type === 'class' ? 'info' : 'success'}>
                        {entry.entry_type === 'class' ? t('planner.classType') : t('planner.studyType')}
                      </Badge>
                      <div className="flex flex-shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => openEdit(entry)}
                          className="rounded-lg p-1.5 text-lavender-400 hover:bg-lavender-100 hover:text-lavender-600"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(entry)}
                          className="rounded-lg p-1.5 text-lavender-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {gaps.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-lavender-400">
                      <span className="font-medium">{t('planner.availableGaps')}:</span>
                      {gaps.map((gap, i) => (
                        <span key={i} className="rounded bg-lavender-50 px-2 py-0.5">
                          {gap.start}–{gap.end}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingEntry ? t('planner.edit') : t('planner.addEntry')}>
        <div className="space-y-4">
          <div>
            <label className="label-text">{t('planner.entryTitle')}</label>
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
              <label className="label-text">{t('planner.schedule')}</label>
              <select
                value={form.entry_type}
                onChange={(e) => setForm({ ...form, entry_type: e.target.value as ScheduleEntryType })}
                className="input-field"
              >
                <option value="class">{t('planner.classType')}</option>
                <option value="study">{t('planner.studyType')}</option>
              </select>
            </div>
            <div>
              <label className="label-text">{t('planner.dayOfWeek')}</label>
              <select
                value={form.day_of_week}
                onChange={(e) => setForm({ ...form, day_of_week: parseInt(e.target.value, 10) })}
                className="input-field"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>{t(`planner.${DAY_KEYS[d]}`)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-text">{t('planner.startTime')}</label>
              <input
                type="time"
                required
                value={form.start_time}
                onChange={(e) => { setForm({ ...form, start_time: e.target.value }); setTimeError(false); }}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-text">{t('planner.endTime')}</label>
              <input
                type="time"
                required
                value={form.end_time}
                onChange={(e) => { setForm({ ...form, end_time: e.target.value }); setTimeError(false); }}
                className="input-field"
              />
            </div>
          </div>
          {timeError && (
            <p className="text-sm text-red-600">{t('planner.endBeforeStart')}</p>
          )}
          <div>
            <label className="label-text">{t('planner.location')}</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-text">{t('planner.subject')}</label>
            <select
              value={form.subject_id}
              onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
              className="input-field"
            >
              <option value="">{t('common.none')}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">
              {t('common.cancel')}
            </button>
            <button onClick={handleSave} disabled={saving || !form.title.trim()} className="btn-primary">
              {saving ? <Spinner size={18} /> : editingEntry ? t('planner.save') : t('planner.create')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        title={t('planner.delete')}
        message={t('planner.deleteConfirm')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
      />
    </div>
  );
}
