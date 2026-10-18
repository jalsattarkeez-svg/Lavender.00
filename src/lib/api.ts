import { supabase } from '@/lib/supabase';
import type {
  Profile,
  LearningPath,
  Subject,
  Lesson,
  LessonStatus,
  LearningPathWithCounts,
  SubjectWithProgress,
  StudySession,
  SessionEvent,
  SessionType,
  EventType,
  DistractionReason,
  StudySessionWithNames,
  TodayStudyStats,
  Goal,
  GoalType,
  GoalWithProgress,
  Exam,
  ExamWithNames,
  Deadline,
  DeadlineWithNames,
  StudyTask,
  StudyTaskWithNames,
  TaskStep,
  StepParentType,
  ScheduleEntry,
  ScheduleEntryWithNames,
  ScheduleEntryType,
  Review,
  ReviewWithNames,
  Mistake,
  MistakeWithNames,
  MistakeCategory,
} from '@/types/database';

// ============================================================
// ANALYTICS
// ============================================================

export type AnalyticsRange = 'today' | '7d' | '30d';

export interface AnalyticsOverview {
  effectiveSeconds: number;
  totalSeconds: number;
  distractionSeconds: number;
  breakSeconds: number;
  focusPercentage: number;
  completedSessions: number;
  distractionCount: number;
}

export interface DailyStudyEntry {
  date: string;
  effectiveSeconds: number;
}

export interface SubjectAnalyticsEntry {
  subjectId: string;
  subjectName: string;
  effectiveSeconds: number;
  totalSeconds: number;
  distractionSeconds: number;
  sessionCount: number;
  focusPercentage: number;
}

export interface DistractionReasonEntry {
  reason: DistractionReason;
  count: number;
  totalSeconds: number;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  daily: DailyStudyEntry[];
  subjects: SubjectAnalyticsEntry[];
  distractionReasons: DistractionReasonEntry[];
  sessions: StudySessionWithNames[];
}

function rangeStartISO(range: AnalyticsRange): string {
  const now = new Date();
  if (range === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  const days = range === '7d' ? 7 : 30;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  return start.toISOString();
}

function dateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function fetchAnalytics(range: AnalyticsRange): Promise<AnalyticsData> {
  const startISO = rangeStartISO(range);

  const { data: sessions, error } = await supabase
    .from('study_sessions')
    .select(`
      *,
      learning_paths(name),
      subjects(name),
      lessons(title)
    `)
    .gte('started_at', startISO)
    .in('status', ['completed', 'active'])
    .order('started_at', { ascending: true });

  if (error) throw error;

  const allSessions = (sessions || []) as unknown as Array<
    StudySession & {
      learning_paths: { name: string } | null;
      subjects: { name: string } | null;
      lessons: { title: string } | null;
    }
  >;

  let effectiveSeconds = 0;
  let totalSeconds = 0;
  let distractionSeconds = 0;
  let breakSeconds = 0;
  let completedSessions = 0;
  let distractionCount = 0;
  let focusWeightedSum = 0;
  let focusWeightTotal = 0;

  const dailyMap = new Map<string, number>();
  const subjectMap = new Map<string, SubjectAnalyticsEntry>();
  const sessionsWithNames: StudySessionWithNames[] = [];

  for (const s of allSessions) {
    const sEff = s.effective_seconds ?? 0;
    const sTotal = s.total_seconds ?? 0;
    const sDistract = s.distraction_seconds ?? 0;
    const sBreak = s.break_seconds ?? 0;
    const sDistractCount = s.distraction_count ?? 0;
    const sFocus = s.focus_percentage ?? 0;

    effectiveSeconds += sEff;
    totalSeconds += sTotal;
    distractionSeconds += sDistract;
    breakSeconds += sBreak;
    distractionCount += sDistractCount;

    if (s.status === 'completed') {
      completedSessions += 1;
      const weight = sTotal - sBreak;
      if (weight > 0) {
        focusWeightedSum += sFocus * weight;
        focusWeightTotal += weight;
      }
    }

    const key = dateKey(s.started_at);
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + sEff);

    if (s.subject_id) {
      const entry = subjectMap.get(s.subject_id) ?? {
        subjectId: s.subject_id,
        subjectName: s.subjects?.name ?? 'Unknown',
        effectiveSeconds: 0,
        totalSeconds: 0,
        distractionSeconds: 0,
        sessionCount: 0,
        focusPercentage: 0,
      };
      entry.effectiveSeconds += sEff;
      entry.totalSeconds += sTotal;
      entry.distractionSeconds += sDistract;
      entry.sessionCount += 1;
      subjectMap.set(s.subject_id, entry);
    }

    sessionsWithNames.push({
      ...s,
      learning_path_name: s.learning_paths?.name ?? null,
      subject_name: s.subjects?.name ?? null,
      lesson_title: s.lessons?.title ?? null,
    });
  }

  const focusPercentage = focusWeightTotal > 0
    ? Math.round((focusWeightedSum / focusWeightTotal) * 100) / 100
    : 0;

  for (const entry of subjectMap.values()) {
    const weight = entry.totalSeconds;
    entry.focusPercentage = weight > 0
      ? Math.round((entry.effectiveSeconds / weight) * 10000) / 100
      : 0;
  }

  const subjects = Array.from(subjectMap.values()).sort(
    (a, b) => b.effectiveSeconds - a.effectiveSeconds
  );

  const daily: DailyStudyEntry[] = [];
  if (allSessions.length > 0) {
    const now = new Date();
    const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = dateKey(d.toISOString());
      daily.push({ date: key, effectiveSeconds: dailyMap.get(key) ?? 0 });
    }
  }

  // Distraction reasons from session_events
  const sessionIds = allSessions.map((s) => s.id);
  let distractionReasons: DistractionReasonEntry[] = [];

  if (sessionIds.length > 0) {
    const { data: events, error: evError } = await supabase
      .from('session_events')
      .select('reason, duration_seconds')
      .in('study_session_id', sessionIds)
      .eq('event_type', 'distraction')
      .not('reason', 'is', null);

    if (evError) throw evError;

    const reasonMap = new Map<string, DistractionReasonEntry>();
    for (const ev of events ?? []) {
      const r = ev.reason as DistractionReason;
      const entry = reasonMap.get(r) ?? { reason: r, count: 0, totalSeconds: 0 };
      entry.count += 1;
      entry.totalSeconds += ev.duration_seconds ?? 0;
      reasonMap.set(r, entry);
    }

    distractionReasons = Array.from(reasonMap.values()).sort(
      (a, b) => b.count - a.count || b.totalSeconds - a.totalSeconds
    );
  }

  return {
    overview: {
      effectiveSeconds,
      totalSeconds,
      distractionSeconds,
      breakSeconds,
      focusPercentage,
      completedSessions,
      distractionCount,
    },
    daily,
    subjects,
    distractionReasons,
    sessions: sessionsWithNames,
  };
}

// ============================================================
// PROFILES
// ============================================================

export async function fetchProfile(): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Profile not found');
  return data as Profile;
}

export async function updateProfile(
  updates: Partial<Pick<Profile, 'display_name' | 'avatar_url' | 'timezone'>>
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .select('*')
    .single();

  if (error) throw error;
  return data as Profile;
}

// ============================================================
// LEARNING PATHS
// ============================================================

export async function fetchLearningPaths(): Promise<LearningPathWithCounts[]> {
  const { data, error } = await supabase
    .from('learning_paths')
    .select('*, subject_count:subjects(count)')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((item) => ({
    ...item,
    subject_count: (item.subject_count as unknown as { count: number }[])?.[0]?.count ?? 0,
  })) as LearningPathWithCounts[];
}

export async function createLearningPath(
  name: string,
  description: string | null,
  icon: string | null
): Promise<LearningPath> {
  const { data, error } = await supabase
    .from('learning_paths')
    .insert({ name, description, icon })
    .select('*')
    .single();

  if (error) throw error;
  return data as LearningPath;
}

export async function updateLearningPath(
  id: string,
  updates: Partial<Pick<LearningPath, 'name' | 'description' | 'icon'>>
): Promise<LearningPath> {
  const { data, error } = await supabase
    .from('learning_paths')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as LearningPath;
}

export async function deleteLearningPath(id: string): Promise<void> {
  const { error } = await supabase.from('learning_paths').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// SUBJECTS
// ============================================================

export async function fetchSubjects(learningPathId: string): Promise<SubjectWithProgress[]> {
  const { data: subjects, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('learning_path_id', learningPathId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!subjects || subjects.length === 0) return [];

  const subjectIds = subjects.map((s) => s.id);
  const { data: lessons, error: lessonsError } = await supabase
    .from('lessons')
    .select('subject_id, status')
    .in('subject_id', subjectIds);

  if (lessonsError) throw lessonsError;

  const lessonMap = new Map<string, { total: number; completed: number }>();
  for (const l of lessons ?? []) {
    const entry = lessonMap.get(l.subject_id) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (l.status === 'completed') entry.completed += 1;
    lessonMap.set(l.subject_id, entry);
  }

  return subjects.map((item) => {
    const counts = lessonMap.get(item.id) ?? { total: 0, completed: 0 };
    return {
      ...item,
      lesson_count: counts.total,
      completed_lessons: counts.completed,
    } as SubjectWithProgress;
  });
}

export async function fetchAllSubjects(): Promise<SubjectWithProgress[]> {
  const { data: subjects, error } = await supabase
    .from('subjects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!subjects || subjects.length === 0) return [];

  const subjectIds = subjects.map((s) => s.id);
  const { data: lessons, error: lessonsError } = await supabase
    .from('lessons')
    .select('subject_id, status')
    .in('subject_id', subjectIds);

  if (lessonsError) throw lessonsError;

  const lessonMap = new Map<string, { total: number; completed: number }>();
  for (const l of lessons ?? []) {
    const entry = lessonMap.get(l.subject_id) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (l.status === 'completed') entry.completed += 1;
    lessonMap.set(l.subject_id, entry);
  }

  return subjects.map((item) => {
    const counts = lessonMap.get(item.id) ?? { total: 0, completed: 0 };
    return {
      ...item,
      lesson_count: counts.total,
      completed_lessons: counts.completed,
    } as SubjectWithProgress;
  });
}

export async function createSubject(
  learningPathId: string,
  name: string,
  description: string | null,
  startDate: string | null,
  endDate: string | null
): Promise<Subject> {
  const { data, error } = await supabase
    .from('subjects')
    .insert({
      learning_path_id: learningPathId,
      name,
      description,
      start_date: startDate,
      end_date: endDate,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Subject;
}

export async function updateSubject(
  id: string,
  updates: Partial<Pick<Subject, 'name' | 'description' | 'start_date' | 'end_date'>>
): Promise<Subject> {
  const { data, error } = await supabase
    .from('subjects')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Subject;
}

export async function deleteSubject(id: string): Promise<void> {
  const { error } = await supabase.from('subjects').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// LESSONS
// ============================================================

export async function fetchLessons(subjectId: string): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('subject_id', subjectId)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return data as Lesson[];
}

export async function createLesson(
  subjectId: string,
  title: string,
  description: string | null,
  orderIndex: number
): Promise<Lesson> {
  const { data, error } = await supabase
    .from('lessons')
    .insert({
      subject_id: subjectId,
      title,
      description,
      order_index: orderIndex,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Lesson;
}

export async function updateLesson(
  id: string,
  updates: Partial<Pick<Lesson, 'title' | 'description' | 'order_index' | 'status'>>
): Promise<Lesson> {
  const { data, error } = await supabase
    .from('lessons')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Lesson;
}

export async function deleteLesson(id: string): Promise<void> {
  const { error } = await supabase.from('lessons').delete().eq('id', id);
  if (error) throw error;
}

export async function updateLessonStatus(id: string, status: LessonStatus): Promise<void> {
  const { error } = await supabase
    .from('lessons')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}

export async function reorderLessons(lessons: { id: string; order_index: number }[]): Promise<void> {
  const promises = lessons.map((l) =>
    supabase.from('lessons').update({ order_index: l.order_index }).eq('id', l.id)
  );
  const results = await Promise.all(promises);
  for (const r of results) {
    if (r.error) throw r.error;
  }
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export interface DashboardStats {
  learningPathCount: number;
  subjectCount: number;
  lessonCount: number;
  completedLessonCount: number;
  completionPercentage: number;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { count: learningPathCount, error: lpError } = await supabase
    .from('learning_paths')
    .select('*', { count: 'exact', head: true });

  if (lpError) throw lpError;

  const { count: subjectCount, error: sError } = await supabase
    .from('subjects')
    .select('*', { count: 'exact', head: true });

  if (sError) throw sError;

  const { count: lessonCount, error: lError } = await supabase
    .from('lessons')
    .select('*', { count: 'exact', head: true });

  if (lError) throw lError;

  const { count: completedLessonCount, error: cError } = await supabase
    .from('lessons')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed');

  if (cError) throw cError;

  const safeLessonCount = lessonCount ?? 0;
  const safeCompleted = completedLessonCount ?? 0;
  const completionPercentage =
    safeLessonCount > 0 ? Math.round((safeCompleted / safeLessonCount) * 100) : 0;

  return {
    learningPathCount: learningPathCount ?? 0,
    subjectCount: subjectCount ?? 0,
    lessonCount: lessonCount ?? 0,
    completedLessonCount: completedLessonCount ?? 0,
    completionPercentage,
  };
}

// ============================================================
// STUDY SESSIONS
// ============================================================

export async function fetchActiveSession(): Promise<StudySession | null> {
  const { data, error } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  return data as StudySession | null;
}

export async function fetchActiveSessionWithEvents(): Promise<{ session: StudySession; events: SessionEvent[] } | null> {
  const session = await fetchActiveSession();
  if (!session) return null;

  const { data: events, error } = await supabase
    .from('session_events')
    .select('*')
    .eq('study_session_id', session.id)
    .order('started_at', { ascending: true });

  if (error) throw error;
  return { session, events: (events || []) as SessionEvent[] };
}

export async function createStudySession(params: {
  learning_path_id: string | null;
  subject_id: string | null;
  lesson_id: string | null;
  session_type: SessionType;
}): Promise<StudySession> {
  const { data, error } = await supabase
    .from('study_sessions')
    .insert({
      learning_path_id: params.learning_path_id,
      subject_id: params.subject_id,
      lesson_id: params.lesson_id,
      session_type: params.session_type,
      started_at: new Date().toISOString(),
      status: 'active',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as StudySession;
}

export async function createSessionEvent(params: {
  study_session_id: string;
  event_type: EventType;
  reason?: DistractionReason | null;
}): Promise<SessionEvent> {
  const { data, error } = await supabase
    .from('session_events')
    .insert({
      study_session_id: params.study_session_id,
      event_type: params.event_type,
      reason: params.reason ?? null,
      started_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as SessionEvent;
}

export async function closeSessionEvent(eventId: string): Promise<SessionEvent> {
  const now = new Date().toISOString();
  const { data: event, error: fetchError } = await supabase
    .from('session_events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!event) throw new Error('Event not found');

  const startedAt = new Date(event.started_at).getTime();
  const durationSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));

  const { data, error } = await supabase
    .from('session_events')
    .update({ ended_at: now, duration_seconds: durationSeconds })
    .eq('id', eventId)
    .select('*')
    .single();

  if (error) throw error;
  return data as SessionEvent;
}

export async function endStudySession(sessionId: string, note?: string | null): Promise<StudySession> {
  const { data: session, error: fetchError } = await supabase
    .from('study_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!session) throw new Error('Session not found');

  // Close any open event
  const { data: openEvents } = await supabase
    .from('session_events')
    .select('*')
    .eq('study_session_id', sessionId)
    .is('ended_at', null);

  if (openEvents && openEvents.length > 0) {
    for (const ev of openEvents) {
      await closeSessionEvent(ev.id);
    }
  }

  // Recalculate totals from all events
  const { data: allEvents, error: eventsError } = await supabase
    .from('session_events')
    .select('*')
    .eq('study_session_id', sessionId);

  if (eventsError) throw eventsError;

  const events = (allEvents || []) as SessionEvent[];
  const now = Date.now();
  const startedAt = new Date(session.started_at).getTime();
  const totalSeconds = Math.max(0, Math.round((now - startedAt) / 1000));

  let effectiveSeconds = 0;
  let distractionSeconds = 0;
  let breakSeconds = 0;
  let distractionCount = 0;

  for (const ev of events) {
    const evDuration = ev.ended_at
      ? Math.max(0, Math.round((new Date(ev.ended_at).getTime() - new Date(ev.started_at).getTime()) / 1000))
      : 0;
    if (ev.event_type === 'study') {
      effectiveSeconds += evDuration;
    } else if (ev.event_type === 'distraction') {
      distractionSeconds += evDuration;
      distractionCount += 1;
    } else if (ev.event_type === 'break') {
      breakSeconds += evDuration;
    }
  }

  effectiveSeconds = Math.max(0, effectiveSeconds);
  distractionSeconds = Math.max(0, distractionSeconds);
  breakSeconds = Math.max(0, breakSeconds);

  const focusDenominator = totalSeconds - breakSeconds;
  const focusPercentage = focusDenominator > 0
    ? Math.min(100, Math.max(0, Math.round((effectiveSeconds / focusDenominator) * 10000) / 100))
    : 0;

  const { data, error } = await supabase
    .from('study_sessions')
    .update({
      ended_at: new Date().toISOString(),
      total_seconds: totalSeconds,
      effective_seconds: effectiveSeconds,
      distraction_seconds: distractionSeconds,
      break_seconds: breakSeconds,
      distraction_count: distractionCount,
      focus_percentage: focusPercentage,
      status: 'completed',
      note: note ?? null,
    })
    .eq('id', sessionId)
    .select('*')
    .single();

  if (error) throw error;
  return data as StudySession;
}

export async function cancelStudySession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('study_sessions')
    .update({ status: 'cancelled', ended_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function fetchSessionEvents(sessionId: string): Promise<SessionEvent[]> {
  const { data, error } = await supabase
    .from('session_events')
    .select('*')
    .eq('study_session_id', sessionId)
    .order('started_at', { ascending: true });

  if (error) throw error;
  return data as SessionEvent[];
}

export async function fetchCompletedSessions(limit = 50, offset = 0): Promise<StudySessionWithNames[]> {
  const { data, error } = await supabase
    .from('study_sessions')
    .select(`
      *,
      learning_paths!inner(name),
      subjects!inner(name),
      lessons(title)
    `)
    .eq('status', 'completed')
    .order('ended_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return (data || []).map((item: Record<string, unknown>) => ({
    ...(item as unknown as StudySession),
    learning_path_name: (item.learning_paths as unknown as { name: string } | null)?.name ?? null,
    subject_name: (item.subjects as unknown as { name: string } | null)?.name ?? null,
    lesson_title: (item.lessons as unknown as { title: string } | null)?.title ?? null,
  })) as StudySessionWithNames[];
}

export async function fetchSessionById(sessionId: string): Promise<StudySessionWithNames | null> {
  const { data, error } = await supabase
    .from('study_sessions')
    .select(`
      *,
      learning_paths(name),
      subjects(name),
      lessons(title)
    `)
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...(data as unknown as StudySession),
    learning_path_name: (data.learning_paths as unknown as { name: string } | null)?.name ?? null,
    subject_name: (data.subjects as unknown as { name: string } | null)?.name ?? null,
    lesson_title: (data.lessons as unknown as { title: string } | null)?.title ?? null,
  } as StudySessionWithNames;
}

export async function fetchTodayStudyStats(): Promise<TodayStudyStats> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { data, error } = await supabase
    .from('study_sessions')
    .select('total_seconds, effective_seconds, distraction_seconds, distraction_count, focus_percentage, status, started_at')
    .gte('started_at', startOfDay)
    .in('status', ['completed', 'active']);

  if (error) throw error;

  const sessions = (data || []) as Pick<StudySession, 'total_seconds' | 'effective_seconds' | 'distraction_seconds' | 'distraction_count' | 'focus_percentage' | 'status' | 'started_at'>[];

  let todayEffectiveSeconds = 0;
  let todayTotalSeconds = 0;
  let todayDistractionSeconds = 0;
  let todayDistractionCount = 0;
  let completedSessionsToday = 0;
  let focusWeightedSum = 0;
  let focusWeightTotal = 0;

  for (const s of sessions) {
    todayTotalSeconds += s.total_seconds ?? 0;
    todayEffectiveSeconds += s.effective_seconds ?? 0;
    todayDistractionSeconds += s.distraction_seconds ?? 0;
    todayDistractionCount += s.distraction_count ?? 0;
    if (s.status === 'completed') {
      completedSessionsToday += 1;
      const weight = (s.total_seconds ?? 0) - (0);
      if (weight > 0) {
        focusWeightedSum += (s.focus_percentage ?? 0) * weight;
        focusWeightTotal += weight;
      }
    }
  }

  const todayFocusPercentage = focusWeightTotal > 0
    ? Math.round((focusWeightedSum / focusWeightTotal) * 100) / 100
    : 0;

  return {
    todayEffectiveSeconds,
    todayTotalSeconds,
    todayDistractionSeconds,
    todayFocusPercentage,
    todayDistractionCount,
    completedSessionsToday,
  };
}

// ============================================================
// GOALS
// ============================================================

export interface GoalWithSubject extends Goal {
  subject_name: string | null;
}

export async function fetchGoals(): Promise<GoalWithSubject[]> {
  const { data, error } = await supabase
    .from('goals')
    .select(`
      *,
      subjects(name)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((item: Record<string, unknown>) => ({
    ...(item as unknown as Goal),
    subject_name: (item.subjects as unknown as { name: string } | null)?.name ?? null,
  })) as GoalWithSubject[];
}

export async function createGoal(params: {
  title: string | null;
  goal_type: GoalType;
  target_value: number;
  subject_id: string | null;
  start_date: string;
  end_date: string;
}): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      title: params.title,
      goal_type: params.goal_type,
      target_value: params.target_value,
      subject_id: params.subject_id,
      start_date: params.start_date,
      end_date: params.end_date,
      status: 'active',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Goal;
}

export async function updateGoal(
  id: string,
  updates: Partial<Pick<Goal, 'title' | 'goal_type' | 'target_value' | 'subject_id' | 'start_date' | 'end_date' | 'status'>>
): Promise<Goal> {
  const { data, error } = await supabase
    .from('goals')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Goal;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) throw error;
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function fetchGoalProgress(goal: GoalWithSubject): Promise<GoalWithProgress> {
  const now = new Date();
  const todayStr = localDateStr(now);
  let currentValue = 0;

  if (goal.goal_type === 'lessons_completed') {
    const startISO = new Date(goal.start_date + 'T00:00:00').toISOString();
    const endISO = new Date(goal.end_date + 'T23:59:59').toISOString();

    let query = supabase
      .from('lessons')
      .select('id, status, updated_at, subject_id')
      .eq('status', 'completed')
      .gte('updated_at', startISO)
      .lte('updated_at', endISO);

    if (goal.subject_id) {
      query = query.eq('subject_id', goal.subject_id);
    }

    const { data: lessons, error } = await query;
    if (error) throw error;
    currentValue = (lessons ?? []).length;
  } else {
    const isTimeGoal = goal.goal_type.endsWith('_effective_time');

    if (isTimeGoal) {
      let startISO: string;
      let endISO: string;

      if (goal.goal_type === 'daily_effective_time') {
        startISO = new Date(todayStr + 'T00:00:00').toISOString();
        endISO = new Date(todayStr + 'T23:59:59').toISOString();
      } else if (goal.goal_type === 'weekly_effective_time') {
        const dayOfWeek = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        startISO = new Date(localDateStr(monday) + 'T00:00:00').toISOString();
        endISO = new Date(localDateStr(sunday) + 'T23:59:59').toISOString();
      } else {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        startISO = new Date(localDateStr(firstOfMonth) + 'T00:00:00').toISOString();
        endISO = new Date(localDateStr(lastOfMonth) + 'T23:59:59').toISOString();
      }

      let query = supabase
        .from('study_sessions')
        .select('effective_seconds')
        .eq('status', 'completed')
        .gte('started_at', startISO)
        .lte('started_at', endISO);

      if (goal.goal_type === 'subject_effective_time' && goal.subject_id) {
        query = query.eq('subject_id', goal.subject_id);
      }

      const { data: sessions, error } = await query;
      if (error) throw error;

      currentValue = (sessions ?? []).reduce(
        (sum: number, s: { effective_seconds: number }) => sum + (s.effective_seconds ?? 0),
        0
      );
    }
  }

  const percentage = goal.target_value > 0
    ? Math.min(100, Math.round((currentValue / goal.target_value) * 10000) / 100)
    : 0;
  const remaining = Math.max(0, goal.target_value - currentValue);

  return {
    ...goal,
    current_value: currentValue,
    percentage,
    remaining,
  };
}

export async function fetchGoalsWithProgress(): Promise<GoalWithProgress[]> {
  const goals = await fetchGoals();
  const results = await Promise.all(goals.map((g) => fetchGoalProgress(g)));
  return results;
}

export async function fetchActiveGoalsForDashboard(limit = 3): Promise<GoalWithProgress[]> {
  const goals = await fetchGoals();
  const active = goals.filter((g) => g.status === 'active');
  const withProgress = await Promise.all(active.map((g) => fetchGoalProgress(g)));
  const sorted = withProgress.sort((a, b) => a.percentage - b.percentage);
  return sorted.slice(0, limit);
}

// ============================================================
// EXAMS
// ============================================================

export async function fetchExams(): Promise<ExamWithNames[]> {
  const { data, error } = await supabase
    .from('exams')
    .select(`
      *,
      learning_paths(name),
      subjects(name)
    `)
    .order('exam_date', { ascending: true });

  if (error) throw error;

  return (data || []).map((item: Record<string, unknown>) => ({
    ...(item as unknown as Exam),
    learning_path_name: (item.learning_paths as unknown as { name: string } | null)?.name ?? null,
    subject_name: (item.subjects as unknown as { name: string } | null)?.name ?? null,
  })) as ExamWithNames[];
}

export async function createExam(params: {
  title: string;
  exam_date: string;
  start_time: string | null;
  location: string | null;
  subject_id: string | null;
  learning_path_id: string | null;
}): Promise<Exam> {
  const { data, error } = await supabase
    .from('exams')
    .insert({
      title: params.title,
      exam_date: params.exam_date,
      start_time: params.start_time,
      location: params.location,
      subject_id: params.subject_id,
      learning_path_id: params.learning_path_id,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Exam;
}

export async function updateExam(
  id: string,
  updates: Partial<Pick<Exam, 'title' | 'exam_date' | 'start_time' | 'location' | 'subject_id' | 'learning_path_id'>>
): Promise<Exam> {
  const { data, error } = await supabase
    .from('exams')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Exam;
}

export async function deleteExam(id: string): Promise<void> {
  const { error } = await supabase.from('exams').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// DEADLINES
// ============================================================

export async function fetchDeadlines(): Promise<DeadlineWithNames[]> {
  const { data, error } = await supabase
    .from('deadlines')
    .select(`
      *,
      learning_paths(name),
      subjects(name)
    `)
    .order('due_date', { ascending: true });

  if (error) throw error;

  return (data || []).map((item: Record<string, unknown>) => ({
    ...(item as unknown as Deadline),
    learning_path_name: (item.learning_paths as unknown as { name: string } | null)?.name ?? null,
    subject_name: (item.subjects as unknown as { name: string } | null)?.name ?? null,
  })) as DeadlineWithNames[];
}

export async function createDeadline(params: {
  title: string;
  due_date: string;
  due_time: string | null;
  description: string | null;
  subject_id: string | null;
  learning_path_id: string | null;
}): Promise<Deadline> {
  const { data, error } = await supabase
    .from('deadlines')
    .insert({
      title: params.title,
      due_date: params.due_date,
      due_time: params.due_time,
      description: params.description,
      subject_id: params.subject_id,
      learning_path_id: params.learning_path_id,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Deadline;
}

export async function updateDeadline(
  id: string,
  updates: Partial<Pick<Deadline, 'title' | 'due_date' | 'due_time' | 'description' | 'subject_id' | 'learning_path_id' | 'status'>>
): Promise<Deadline> {
  const { data, error } = await supabase
    .from('deadlines')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Deadline;
}

export async function deleteDeadline(id: string): Promise<void> {
  const { error } = await supabase.from('deadlines').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// DASHBOARD UPCOMING
// ============================================================

export interface DashboardUpcoming {
  nextExam: ExamWithNames | null;
  nextDeadline: DeadlineWithNames | null;
}

export async function fetchDashboardUpcoming(): Promise<DashboardUpcoming> {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const [examsResult, deadlinesResult] = await Promise.all([
    supabase
      .from('exams')
      .select(`
        *,
        learning_paths(name),
        subjects(name)
      `)
      .gte('exam_date', todayStr)
      .order('exam_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('deadlines')
      .select(`
        *,
        learning_paths(name),
        subjects(name)
      `)
      .eq('status', 'pending')
      .order('due_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  if (examsResult.error) throw examsResult.error;
  if (deadlinesResult.error) throw deadlinesResult.error;

  const examData = examsResult.data as Record<string, unknown> | null;
  const deadlineData = deadlinesResult.data as Record<string, unknown> | null;

  return {
    nextExam: examData
      ? {
          ...(examData as unknown as Exam),
          learning_path_name: (examData.learning_paths as unknown as { name: string } | null)?.name ?? null,
          subject_name: (examData.subjects as unknown as { name: string } | null)?.name ?? null,
        }
      : null,
    nextDeadline: deadlineData
      ? {
          ...(deadlineData as unknown as Deadline),
          learning_path_name: (deadlineData.learning_paths as unknown as { name: string } | null)?.name ?? null,
          subject_name: (deadlineData.subjects as unknown as { name: string } | null)?.name ?? null,
        }
      : null,
  };
}

// ============================================================
// STUDY TASKS (Daily Plan)
// ============================================================

export async function fetchStudyTasks(date?: string): Promise<StudyTaskWithNames[]> {
  const todayLocal = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const targetDate = date ?? todayLocal;

  const { data, error } = await supabase
    .from('study_tasks')
    .select(`
      *,
      learning_paths(name),
      subjects(name),
      lessons(title)
    `)
    .eq('planned_date', targetDate)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const tasks = (data || []) as unknown as Array<
    StudyTask & { learning_paths: { name: string } | null; subjects: { name: string } | null; lessons: { title: string } | null }
  >;

  // Fetch step counts for all tasks
  const taskIds = tasks.map((t) => t.id);
  const stepCounts = new Map<string, { total: number; completed: number }>();

  if (taskIds.length > 0) {
    const { data: steps } = await supabase
      .from('task_steps')
      .select('study_task_id, completed')
      .in('study_task_id', taskIds)
      .eq('parent_type', 'study_task');

    if (steps) {
      for (const s of steps as unknown as Array<{ study_task_id: string | null; completed: boolean }>) {
        if (!s.study_task_id) continue;
        const entry = stepCounts.get(s.study_task_id) ?? { total: 0, completed: 0 };
        entry.total += 1;
        if (s.completed) entry.completed += 1;
        stepCounts.set(s.study_task_id, entry);
      }
    }
  }

  return tasks.map((t) => {
    const sc = stepCounts.get(t.id) ?? { total: 0, completed: 0 };
    return {
      ...t,
      learning_path_name: t.learning_paths?.name ?? null,
      subject_name: t.subjects?.name ?? null,
      lesson_title: t.lessons?.title ?? null,
      step_count: sc.total,
      completed_steps: sc.completed,
    };
  });
}

export async function fetchAllStudyTasks(limit = 100): Promise<StudyTaskWithNames[]> {
  const { data, error } = await supabase
    .from('study_tasks')
    .select(`
      *,
      learning_paths(name),
      subjects(name),
      lessons(title)
    `)
    .order('planned_date', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const tasks = (data || []) as unknown as Array<
    StudyTask & { learning_paths: { name: string } | null; subjects: { name: string } | null; lessons: { title: string } | null }
  >;

  return tasks.map((t) => ({
    ...t,
    learning_path_name: t.learning_paths?.name ?? null,
    subject_name: t.subjects?.name ?? null,
    lesson_title: t.lessons?.title ?? null,
    step_count: 0,
    completed_steps: 0,
  }));
}

export async function createStudyTask(params: {
  title: string;
  description?: string | null;
  planned_date: string;
  planned_duration?: number | null;
  learning_path_id?: string | null;
  subject_id?: string | null;
  lesson_id?: string | null;
}): Promise<StudyTask> {
  const { data, error } = await supabase
    .from('study_tasks')
    .insert({
      title: params.title,
      description: params.description ?? null,
      planned_date: params.planned_date,
      planned_duration: params.planned_duration ?? null,
      learning_path_id: params.learning_path_id ?? null,
      subject_id: params.subject_id ?? null,
      lesson_id: params.lesson_id ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as StudyTask;
}

export async function updateStudyTask(
  id: string,
  updates: Partial<Pick<StudyTask, 'title' | 'description' | 'planned_date' | 'planned_duration' | 'subject_id' | 'learning_path_id' | 'lesson_id' | 'status'>>
): Promise<StudyTask> {
  const { data, error } = await supabase
    .from('study_tasks')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as StudyTask;
}

export async function deleteStudyTask(id: string): Promise<void> {
  const { error } = await supabase.from('study_tasks').delete().eq('id', id);
  if (error) throw error;
}

export async function carryForwardTasks(fromDate: string, toDate: string): Promise<number> {
  const { data, error } = await supabase
    .from('study_tasks')
    .select('id, title, description, planned_duration, learning_path_id, subject_id, lesson_id')
    .eq('planned_date', fromDate)
    .eq('status', 'pending');

  if (error) throw error;
  if (!data || data.length === 0) return 0;

  const rows = (data as unknown as Array<{
    id: string; title: string; description: string | null; planned_duration: number | null;
    learning_path_id: string | null; subject_id: string | null; lesson_id: string | null;
  }>).map((r) => ({
    title: r.title,
    description: r.description,
    planned_date: toDate,
    planned_duration: r.planned_duration,
    learning_path_id: r.learning_path_id,
    subject_id: r.subject_id,
    lesson_id: r.lesson_id,
    carried_forward: true,
    status: 'pending' as const,
  }));

  const { error: insertError } = await supabase.from('study_tasks').insert(rows);
  if (insertError) throw insertError;

  return rows.length;
}

// ============================================================
// TASK STEPS (Checklists)
// ============================================================

export async function fetchTaskSteps(parentType: StepParentType, parentId: string): Promise<TaskStep[]> {
  const column = parentType === 'study_task' ? 'study_task_id' : 'lesson_id';
  const { data, error } = await supabase
    .from('task_steps')
    .select('*')
    .eq('parent_type', parentType)
    .eq(column, parentId)
    .order('order_index', { ascending: true });

  if (error) throw error;
  return (data || []) as TaskStep[];
}

export async function createTaskStep(params: {
  parent_type: StepParentType;
  study_task_id?: string | null;
  lesson_id?: string | null;
  title: string;
  order_index?: number;
}): Promise<TaskStep> {
  const { data, error } = await supabase
    .from('task_steps')
    .insert({
      parent_type: params.parent_type,
      study_task_id: params.study_task_id ?? null,
      lesson_id: params.lesson_id ?? null,
      title: params.title,
      order_index: params.order_index ?? 0,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as TaskStep;
}

export async function updateTaskStep(
  id: string,
  updates: Partial<Pick<TaskStep, 'title' | 'order_index' | 'completed'>>
): Promise<TaskStep> {
  const { data, error } = await supabase
    .from('task_steps')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as TaskStep;
}

export async function deleteTaskStep(id: string): Promise<void> {
  const { error } = await supabase.from('task_steps').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// SCHEDULE ENTRIES (Weekly Planner)
// ============================================================

export async function fetchScheduleEntries(): Promise<ScheduleEntryWithNames[]> {
  const { data, error } = await supabase
    .from('schedule_entries')
    .select(`
      *,
      subjects(name)
    `)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) throw error;

  return (data || []).map((item) => {
    const entry = item as unknown as ScheduleEntry & { subjects: { name: string } | null };
    return {
      ...entry,
      subject_name: entry.subjects?.name ?? null,
    };
  });
}

export async function createScheduleEntry(params: {
  title: string;
  entry_type: ScheduleEntryType;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location?: string | null;
  subject_id?: string | null;
}): Promise<ScheduleEntry> {
  const { data, error } = await supabase
    .from('schedule_entries')
    .insert({
      title: params.title,
      entry_type: params.entry_type,
      day_of_week: params.day_of_week,
      start_time: params.start_time,
      end_time: params.end_time,
      location: params.location ?? null,
      subject_id: params.subject_id ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as ScheduleEntry;
}

export async function updateScheduleEntry(
  id: string,
  updates: Partial<Pick<ScheduleEntry, 'title' | 'entry_type' | 'day_of_week' | 'start_time' | 'end_time' | 'location' | 'subject_id'>>
): Promise<ScheduleEntry> {
  const { data, error } = await supabase
    .from('schedule_entries')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as ScheduleEntry;
}

export async function deleteScheduleEntry(id: string): Promise<void> {
  const { error } = await supabase.from('schedule_entries').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// REVIEWS (Spaced Revision)
// ============================================================

export async function fetchReviews(): Promise<ReviewWithNames[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      *,
      subjects(name),
      lessons(title)
    `)
    .order('review_date', { ascending: true });

  if (error) throw error;

  return (data || []).map((item) => {
    const r = item as unknown as Review & { subjects: { name: string } | null; lessons: { title: string } | null };
    return {
      ...r,
      subject_name: r.subjects?.name ?? null,
      lesson_title: r.lessons?.title ?? null,
    };
  });
}

export async function fetchReviewsDueToday(): Promise<ReviewWithNames[]> {
  const todayLocal = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const { data, error } = await supabase
    .from('reviews')
    .select(`
      *,
      subjects(name),
      lessons(title)
    `)
    .eq('status', 'pending')
    .lte('review_date', todayLocal)
    .order('review_date', { ascending: true });

  if (error) throw error;

  return (data || []).map((item) => {
    const r = item as unknown as Review & { subjects: { name: string } | null; lessons: { title: string } | null };
    return {
      ...r,
      subject_name: r.subjects?.name ?? null,
      lesson_title: r.lessons?.title ?? null,
    };
  });
}

export async function createReview(params: {
  title: string;
  review_date: string;
  subject_id?: string | null;
  lesson_id?: string | null;
}): Promise<Review> {
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      title: params.title,
      review_date: params.review_date,
      subject_id: params.subject_id ?? null,
      lesson_id: params.lesson_id ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Review;
}

export async function updateReview(
  id: string,
  updates: Partial<Pick<Review, 'title' | 'review_date' | 'status' | 'confidence' | 'next_review_date' | 'subject_id' | 'lesson_id'>>
): Promise<Review> {
  const { data, error } = await supabase
    .from('reviews')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Review;
}

export async function deleteReview(id: string): Promise<void> {
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// MISTAKES (Mistake Log)
// ============================================================

export async function fetchMistakes(): Promise<MistakeWithNames[]> {
  const { data, error } = await supabase
    .from('mistakes')
    .select(`
      *,
      subjects(name),
      lessons(title)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((item) => {
    const m = item as unknown as Mistake & { subjects: { name: string } | null; lessons: { title: string } | null };
    return {
      ...m,
      subject_name: m.subjects?.name ?? null,
      lesson_title: m.lessons?.title ?? null,
    };
  });
}

export async function createMistake(params: {
  title: string;
  category: MistakeCategory;
  subject_id?: string | null;
  lesson_id?: string | null;
  topic?: string | null;
  explanation?: string | null;
  correct_approach?: string | null;
  follow_up_date?: string | null;
}): Promise<Mistake> {
  const { data, error } = await supabase
    .from('mistakes')
    .insert({
      title: params.title,
      category: params.category,
      subject_id: params.subject_id ?? null,
      lesson_id: params.lesson_id ?? null,
      topic: params.topic ?? null,
      explanation: params.explanation ?? null,
      correct_approach: params.correct_approach ?? null,
      follow_up_date: params.follow_up_date ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as Mistake;
}

export async function updateMistake(
  id: string,
  updates: Partial<Pick<Mistake, 'title' | 'category' | 'subject_id' | 'lesson_id' | 'topic' | 'explanation' | 'correct_approach' | 'follow_up_date' | 'status'>>
): Promise<Mistake> {
  const { data, error } = await supabase
    .from('mistakes')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Mistake;
}

export async function deleteMistake(id: string): Promise<void> {
  const { error } = await supabase.from('mistakes').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// DASHBOARD: Reviews & Tasks summary
// ============================================================

export interface DashboardTasksSummary {
  todayTasks: StudyTaskWithNames[];
  todayCompleted: number;
  todayTotal: number;
  nextTask: StudyTaskWithNames | null;
  reviewsDue: ReviewWithNames[];
  reviewsOverdue: number;
}

export async function fetchDashboardTasksSummary(): Promise<DashboardTasksSummary> {
  const [tasksResult, reviewsResult] = await Promise.all([
    fetchStudyTasks(),
    fetchReviewsDueToday(),
  ]);

  const todayCompleted = tasksResult.filter((t) => t.status === 'completed').length;
  const nextTask = tasksResult.find((t) => t.status === 'pending') ?? null;
  const todayLocal = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const reviewsOverdue = reviewsResult.filter((r) => r.review_date < todayLocal).length;

  return {
    todayTasks: tasksResult,
    todayCompleted,
    todayTotal: tasksResult.length,
    nextTask,
    reviewsDue: reviewsResult,
    reviewsOverdue,
  };
}

// ============================================================
// ANALYTICS: Phase 6 metrics
// ============================================================

export interface AnalyticsProductivity {
  planCompletionRate: number;
  reviewsCompleted: number;
  reviewsPending: number;
  unresolvedMistakes: number;
  resolvedMistakes: number;
  mistakesBySubject: Array<{ subjectName: string; unresolved: number }>;
}

export async function fetchAnalyticsProductivity(): Promise<AnalyticsProductivity> {
  const todayLocal = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const [tasksResult, reviewsResult, mistakesResult] = await Promise.all([
    supabase.from('study_tasks').select('status').eq('planned_date', todayLocal),
    supabase.from('reviews').select('status').in('status', ['pending', 'completed']),
    supabase.from('mistakes').select('status, subject_id, subjects(name)').eq('status', 'unresolved'),
  ]);

  if (tasksResult.error) throw tasksResult.error;
  if (reviewsResult.error) throw reviewsResult.error;
  if (mistakesResult.error) throw mistakesResult.error;

  const tasks = (tasksResult.data || []) as unknown as Array<{ status: string }>;
  const reviews = (reviewsResult.data || []) as unknown as Array<{ status: string }>;
  const mistakes = (mistakesResult.data || []) as unknown as Array<{
    status: string; subject_id: string | null; subjects: { name: string } | null;
  }>;

  const planCompletionRate = tasks.length > 0
    ? Math.round((tasks.filter((t) => t.status === 'completed').length / tasks.length) * 100)
    : 0;

  const reviewsCompleted = reviews.filter((r) => r.status === 'completed').length;
  const reviewsPending = reviews.filter((r) => r.status === 'pending').length;

  const unresolvedMistakes = mistakes.length;

  const subjectMap = new Map<string, { subjectName: string; unresolved: number }>();
  for (const m of mistakes) {
    if (!m.subject_id) continue;
    const name = m.subjects?.name ?? 'Unknown';
    const entry = subjectMap.get(m.subject_id) ?? { subjectName: name, unresolved: 0 };
    entry.unresolved += 1;
    subjectMap.set(m.subject_id, entry);
  }

  return {
    planCompletionRate,
    reviewsCompleted,
    reviewsPending,
    unresolvedMistakes,
    resolvedMistakes: 0,
    mistakesBySubject: Array.from(subjectMap.values()).sort((a, b) => b.unresolved - a.unresolved),
  };
}
