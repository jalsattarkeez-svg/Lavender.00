import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchLearningPaths, fetchSubjects, fetchLessons } from '@/lib/api';
import type { LearningPathWithCounts, SubjectWithProgress, Lesson, SessionType } from '@/types/database';
import { Spinner, EmptyState } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import { BookOpen, GraduationCap, ClipboardList, Timer, ChevronRight } from 'lucide-react';
import { useT } from '@/lib/i18n';

const sessionTypes: { value: SessionType; label: string; icon: string }[] = [
  { value: 'studying', label: 'Studying', icon: '📖' },
  { value: 'watching_lecture', label: 'Watching Lecture', icon: '🎥' },
  { value: 'solving_questions', label: 'Solving Questions', icon: '✏️' },
  { value: 'reviewing', label: 'Reviewing', icon: '🔄' },
  { value: 'reading', label: 'Reading', icon: '📚' },
  { value: 'other', label: 'Other', icon: '📝' },
];

interface StartStudyModalProps {
  open: boolean;
  onClose: () => void;
  onStart: (params: {
    learning_path_id: string | null;
    subject_id: string | null;
    lesson_id: string | null;
    session_type: SessionType;
  }) => void;
}

export function StartStudyModal({ open, onClose, onStart }: StartStudyModalProps) {
  const t = useT();
  const navigate = useNavigate();
  const [paths, setPaths] = useState<LearningPathWithCounts[]>([]);
  const [subjects, setSubjects] = useState<SubjectWithProgress[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedLesson, setSelectedLesson] = useState<string>('');
  const [selectedType, setSelectedType] = useState<SessionType>('studying');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchLearningPaths();
        setPaths(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!selectedPath) {
      setSubjects([]);
      return;
    }
    (async () => {
      try {
        const data = await fetchSubjects(selectedPath);
        setSubjects(data);
      } catch {
        setSubjects([]);
      }
    })();
    setSelectedSubject('');
    setSelectedLesson('');
    setLessons([]);
  }, [selectedPath]);

  useEffect(() => {
    if (!selectedSubject) {
      setLessons([]);
      return;
    }
    (async () => {
      try {
        const data = await fetchLessons(selectedSubject);
        setLessons(data);
      } catch {
        setLessons([]);
      }
    })();
    setSelectedLesson('');
  }, [selectedSubject]);

  const handleStart = async () => {
    if (!selectedPath || !selectedSubject) return;
    setStarting(true);
    try {
      onStart({
        learning_path_id: selectedPath || null,
        subject_id: selectedSubject || null,
        lesson_id: selectedLesson || null,
        session_type: selectedType,
      });
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('study.startTitle')} maxWidth="max-w-lg">
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner size={32} />
        </div>
      ) : paths.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={40} />}
          title={t('learning.noPaths')}
          description={t('learning.noPathsDesc')}
          action={
            <button
              onClick={() => {
                onClose();
                navigate('/learning');
              }}
              className="btn-primary"
            >
              {t('dashboard.goToLearning')}
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Learning Path */}
          <div>
            <label className="label-text">
              <BookOpen size={14} className="mr-1 inline" /> {t('study.learningPath')}
            </label>
            <select
              value={selectedPath}
              onChange={(e) => setSelectedPath(e.target.value)}
              className="input-field"
            >
              <option value="">Select a learning path...</option>
              {paths.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="label-text">
              <GraduationCap size={14} className="mr-1 inline" /> {t('study.subject')}
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              disabled={!selectedPath}
              className="input-field disabled:bg-lavender-50 disabled:text-lavender-300"
            >
              <option value="">Select a subject...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Lesson */}
          <div>
            <label className="label-text">
              <ClipboardList size={14} className="mr-1 inline" /> {t('study.lesson')} <span className="text-lavender-300">{t('common.optional')}</span>
            </label>
            <select
              value={selectedLesson}
              onChange={(e) => setSelectedLesson(e.target.value)}
              disabled={!selectedSubject}
              className="input-field disabled:bg-lavender-50 disabled:text-lavender-300"
            >
              <option value="">No specific lesson</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </div>

          {/* Session Type */}
          <div>
            <label className="label-text">
              <Timer size={14} className="mr-1 inline" /> {t('study.sessionType')}
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {sessionTypes.map((type) => {
                const labelKey = type.value === 'studying' ? 'study.typeStudying'
                  : type.value === 'watching_lecture' ? 'study.typeWatching'
                  : type.value === 'solving_questions' ? 'study.typeSolving'
                  : type.value === 'reviewing' ? 'study.typeReviewing'
                  : type.value === 'reading' ? 'study.typeReading'
                  : 'study.typeOther';
                return (
                  <button
                    key={type.value}
                    onClick={() => setSelectedType(type.value)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                      selectedType === type.value
                        ? 'border-lavender-500 bg-lavender-100 text-lavender-800'
                        : 'border-lavender-200 bg-white text-lavender-500 hover:border-lavender-300 hover:bg-lavender-50'
                    }`}
                  >
                    <span className="text-lg">{type.icon}</span>
                    {t(labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="btn-secondary">
              {t('study.cancel')}
            </button>
            <button
              onClick={handleStart}
              disabled={!selectedPath || !selectedSubject || starting}
              className="btn-primary"
            >
              {starting ? <Spinner size={18} /> : <>{t('study.start')} <ChevronRight size={18} /></>}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
