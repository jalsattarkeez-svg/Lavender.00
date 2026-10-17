export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

export type SessionType =
  | 'studying'
  | 'watching_lecture'
  | 'solving_questions'
  | 'reviewing'
  | 'reading'
  | 'other';

export type SessionStatus = 'active' | 'completed' | 'cancelled';

export type EventType = 'study' | 'distraction' | 'break';

export type DistractionReason =
  | 'phone'
  | 'social_media'
  | 'daydreaming'
  | 'tired'
  | 'food_drink'
  | 'interruption'
  | 'difficult_material'
  | 'boredom'
  | 'other';

export interface Profile {
  id: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface LearningPath {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  learning_path_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  description: string | null;
  order_index: number;
  status: LessonStatus;
  created_at: string;
  updated_at: string;
}

export interface SubjectWithProgress extends Subject {
  lesson_count: number;
  completed_lessons: number;
}

export interface LearningPathWithCounts extends LearningPath {
  subject_count: number;
}

export interface StudySession {
  id: string;
  user_id: string;
  learning_path_id: string | null;
  subject_id: string | null;
  lesson_id: string | null;
  session_type: SessionType;
  started_at: string;
  ended_at: string | null;
  total_seconds: number;
  effective_seconds: number;
  distraction_seconds: number;
  break_seconds: number;
  distraction_count: number;
  focus_percentage: number;
  status: SessionStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionEvent {
  id: string;
  user_id: string;
  study_session_id: string;
  event_type: EventType;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  reason: DistractionReason | null;
  created_at: string;
}

export interface StudySessionWithNames extends StudySession {
  learning_path_name: string | null;
  subject_name: string | null;
  lesson_title: string | null;
}

export interface TodayStudyStats {
  todayEffectiveSeconds: number;
  todayTotalSeconds: number;
  todayDistractionSeconds: number;
  todayFocusPercentage: number;
  todayDistractionCount: number;
  completedSessionsToday: number;
}

export type GoalType =
  | 'daily_effective_time'
  | 'weekly_effective_time'
  | 'monthly_effective_time'
  | 'subject_effective_time'
  | 'lessons_completed';

export type GoalStatus = 'active' | 'completed' | 'expired';

export interface Goal {
  id: string;
  user_id: string;
  title: string | null;
  goal_type: GoalType;
  target_value: number;
  subject_id: string | null;
  start_date: string;
  end_date: string;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
}

export interface GoalWithProgress extends Goal {
  current_value: number;
  percentage: number;
  remaining: number;
  subject_name: string | null;
}

export interface Exam {
  id: string;
  user_id: string;
  learning_path_id: string | null;
  subject_id: string | null;
  title: string;
  exam_date: string;
  start_time: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExamWithNames extends Exam {
  learning_path_name: string | null;
  subject_name: string | null;
}

export type DeadlineStatus = 'pending' | 'completed';

export interface Deadline {
  id: string;
  user_id: string;
  learning_path_id: string | null;
  subject_id: string | null;
  title: string;
  due_date: string;
  due_time: string | null;
  description: string | null;
  status: DeadlineStatus;
  created_at: string;
  updated_at: string;
}

export interface DeadlineWithNames extends Deadline {
  learning_path_name: string | null;
  subject_name: string | null;
}

// ── Phase 6: Study Productivity ──────────────────────────────

export type TaskStatus = 'pending' | 'completed';

export interface StudyTask {
  id: string;
  user_id: string;
  learning_path_id: string | null;
  subject_id: string | null;
  lesson_id: string | null;
  title: string;
  description: string | null;
  planned_date: string;
  planned_duration: number | null;
  status: TaskStatus;
  carried_forward: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudyTaskWithNames extends StudyTask {
  learning_path_name: string | null;
  subject_name: string | null;
  lesson_title: string | null;
  step_count: number;
  completed_steps: number;
}

export type StepParentType = 'study_task' | 'lesson';

export interface TaskStep {
  id: string;
  user_id: string;
  parent_type: StepParentType;
  study_task_id: string | null;
  lesson_id: string | null;
  title: string;
  order_index: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export type ScheduleEntryType = 'class' | 'study';

export interface ScheduleEntry {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  entry_type: ScheduleEntryType;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleEntryWithNames extends ScheduleEntry {
  subject_name: string | null;
}

export type ReviewStatus = 'pending' | 'completed' | 'skipped' | 'cancelled';
export type ReviewConfidence = 'difficult' | 'partial' | 'understood';

export interface Review {
  id: string;
  user_id: string;
  subject_id: string | null;
  lesson_id: string | null;
  title: string;
  review_date: string;
  status: ReviewStatus;
  confidence: ReviewConfidence | null;
  next_review_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewWithNames extends Review {
  subject_name: string | null;
  lesson_title: string | null;
}

export type MistakeCategory =
  | 'conceptual'
  | 'formula'
  | 'calculation'
  | 'misreading'
  | 'forgotten'
  | 'other';

export type MistakeStatus = 'unresolved' | 'resolved';

export interface Mistake {
  id: string;
  user_id: string;
  subject_id: string | null;
  lesson_id: string | null;
  title: string;
  topic: string | null;
  category: MistakeCategory;
  explanation: string | null;
  correct_approach: string | null;
  follow_up_date: string | null;
  status: MistakeStatus;
  created_at: string;
  updated_at: string;
}

export interface MistakeWithNames extends Mistake {
  subject_name: string | null;
  lesson_title: string | null;
}
