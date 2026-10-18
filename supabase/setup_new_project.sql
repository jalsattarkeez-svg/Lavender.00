/*
# Lavender Lab - Core Schema

## Overview
Creates the foundational database schema for Lavender Lab, a personal study and learning management system.
Each user's data is strictly isolated via Row Level Security (RLS) policies.

## New Tables

### 1. profiles
Stores user profile information linked to Supabase Auth.
- `id` (uuid, PK, references auth.users) — same as the auth user ID
- `display_name` (text, nullable) — user-chosen display name
- `email` (text, not null) — copied from auth email
- `avatar_url` (text, nullable) — optional avatar image URL
- `timezone` (text, default 'UTC') — user's timezone
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### 2. learning_paths
Groups related subjects (e.g., University, Programming).
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users ON DELETE CASCADE)
- `name` (text, NOT NULL)
- `description` (text, nullable)
- `icon` (text, nullable) — stores an icon identifier
- `created_at`, `updated_at` (timestamptz)

### 3. subjects
A subject/course belonging to a learning path.
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users ON DELETE CASCADE)
- `learning_path_id` (uuid, NOT NULL, references learning_paths ON DELETE CASCADE)
- `name` (text, NOT NULL)
- `description` (text, nullable)
- `start_date` (date, nullable)
- `end_date` (date, nullable)
- `created_at`, `updated_at` (timestamptz)

### 4. lessons
A lesson belonging to a subject.
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users ON DELETE CASCADE)
- `subject_id` (uuid, NOT NULL, references subjects ON DELETE CASCADE)
- `title` (text, NOT NULL)
- `description` (text, nullable)
- `order_index` (integer, default 0)
- `status` (text, NOT NULL, default 'not_started') — CHECK constraint: not_started, in_progress, completed
- `created_at`, `updated_at` (timestamptz)

## Security
- RLS enabled on ALL tables.
- profiles: user can SELECT and UPDATE only their own profile.
- learning_paths, subjects, lessons: full CRUD scoped to owner via auth.uid() = user_id.
- Child table policies (subjects, lessons) also verify ownership of the parent record via EXISTS subqueries to prevent cross-user access through parent_id manipulation.
- A trigger auto-creates a profile row when a new auth user signs up.
- A trigger auto-updates updated_at on row modification.

## Important Notes
1. The `handle_new_user` trigger fires AFTER INSERT on auth.users to create a matching profile row.
2. The `update_updated_at` trigger fires BEFORE UPDATE on all four tables to refresh updated_at.
3. All owner columns default to auth.uid() so frontend inserts that omit user_id still pass the RLS WITH CHECK.
4. Subject and lesson policies include EXISTS checks against their parent's user_id, so a user cannot create a subject under another user's learning path or a lesson under another user's subject.
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text NOT NULL,
  avatar_url text,
  timezone text NOT NULL DEFAULT 'UTC',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- LEARNING PATHS
-- ============================================================
CREATE TABLE IF NOT EXISTS learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_learning_paths" ON learning_paths;
CREATE POLICY "select_own_learning_paths" ON learning_paths FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_learning_paths" ON learning_paths;
CREATE POLICY "insert_own_learning_paths" ON learning_paths FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_learning_paths" ON learning_paths;
CREATE POLICY "update_own_learning_paths" ON learning_paths FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_learning_paths" ON learning_paths;
CREATE POLICY "delete_own_learning_paths" ON learning_paths FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- SUBJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  learning_path_id uuid NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_subjects" ON subjects;
CREATE POLICY "select_own_subjects" ON subjects FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_subjects" ON subjects;
CREATE POLICY "insert_own_subjects" ON subjects FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = subjects.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_subjects" ON subjects;
CREATE POLICY "update_own_subjects" ON subjects FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = subjects.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_subjects" ON subjects;
CREATE POLICY "delete_own_subjects" ON subjects FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- LESSONS
-- ============================================================
CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lessons" ON lessons;
CREATE POLICY "select_own_lessons" ON lessons FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_lessons" ON lessons;
CREATE POLICY "insert_own_lessons" ON lessons FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM subjects
      WHERE subjects.id = lessons.subject_id
      AND subjects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_lessons" ON lessons;
CREATE POLICY "update_own_lessons" ON lessons FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM subjects
      WHERE subjects.id = lessons.subject_id
      AND subjects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_lessons" ON lessons;
CREATE POLICY "delete_own_lessons" ON lessons FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_learning_paths_user_id ON learning_paths(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_learning_path_id ON subjects(learning_path_id);
CREATE INDEX IF NOT EXISTS idx_lessons_user_id ON lessons(user_id);
CREATE INDEX IF NOT EXISTS idx_lessons_subject_id ON lessons(subject_id);

-- ============================================================
-- TRIGGERS: Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TRIGGERS: Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_learning_paths_updated_at ON learning_paths;
CREATE TRIGGER update_learning_paths_updated_at
  BEFORE UPDATE ON learning_paths
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_subjects_updated_at ON subjects;
CREATE TRIGGER update_subjects_updated_at
  BEFORE UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_lessons_updated_at ON lessons;
CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
/*
# Fix security advisor warnings

1. Set search_path on update_updated_at function to prevent search_path mutable warning.
2. Revoke EXECUTE on handle_new_user from anon and authenticated roles — it should only be called by the trigger, not via the REST API.
*/

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
/*
# Lavender Lab Phase 2 - Study Sessions

## Overview
Adds study session tracking with two new tables: study_sessions and session_events.
Sessions track actual study time vs distraction/break time using timestamp-based calculations.

## New Tables

### 1. study_sessions
Records each study session with timing and focus metrics.
- id (uuid, PK)
- user_id (uuid, NOT NULL, DEFAULT auth.uid(), FK to auth.users ON DELETE CASCADE)
- learning_path_id (uuid, FK to learning_paths ON DELETE SET NULL)
- subject_id (uuid, FK to subjects ON DELETE SET NULL)
- lesson_id (uuid, nullable, FK to lessons ON DELETE SET NULL)
- session_type (text, NOT NULL) — studying, watching_lecture, solving_questions, reviewing, reading, other
- started_at (timestamptz, NOT NULL, DEFAULT now())
- ended_at (timestamptz, nullable)
- total_seconds (integer, NOT NULL, DEFAULT 0, CHECK >= 0)
- effective_seconds (integer, NOT NULL, DEFAULT 0, CHECK >= 0)
- distraction_seconds (integer, NOT NULL, DEFAULT 0, CHECK >= 0)
- break_seconds (integer, NOT NULL, DEFAULT 0, CHECK >= 0)
- distraction_count (integer, NOT NULL, DEFAULT 0, CHECK >= 0)
- focus_percentage (numeric, NOT NULL, DEFAULT 0, CHECK between 0 and 100)
- status (text, NOT NULL, DEFAULT 'active') — CHECK: active, completed, cancelled
- note (text, nullable)
- created_at, updated_at (timestamptz)

### 2. session_events
Records individual state changes within a study session.
- id (uuid, PK)
- user_id (uuid, NOT NULL, DEFAULT auth.uid(), FK to auth.users ON DELETE CASCADE)
- study_session_id (uuid, NOT NULL, FK to study_sessions ON DELETE CASCADE)
- event_type (text, NOT NULL) — CHECK: study, distraction, break
- started_at (timestamptz, NOT NULL, DEFAULT now())
- ended_at (timestamptz, nullable)
- duration_seconds (integer, NOT NULL, DEFAULT 0, CHECK >= 0)
- reason (text, nullable) — CHECK: phone, social_media, daydreaming, tired, food_drink, interruption, difficult_material, boredom, other, or NULL
- created_at (timestamptz)

## Security
- RLS enabled on both tables.
- study_sessions: full CRUD scoped to auth.uid() = user_id.
- session_events: full CRUD scoped to auth.uid() = user_id, with EXISTS check that the parent session belongs to the same user.
- A unique partial index on study_sessions(user_id) WHERE status = 'active' prevents multiple active sessions per user.
- CHECK constraints ensure no negative durations and focus_percentage between 0-100.

## Important Notes
1. The unique partial index enforces one active session per user at the database level.
2. learning_path_id, subject_id, and lesson_id use ON DELETE SET NULL so deleting learning data doesn't lose session history.
3. All owner columns default to auth.uid() so frontend inserts that omit user_id still pass RLS.
4. session_events INSERT/UPDATE policies include EXISTS check against study_sessions.user_id to prevent cross-user event creation.
5. updated_at trigger added to study_sessions.
*/

-- ============================================================
-- STUDY SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS study_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  learning_path_id uuid REFERENCES learning_paths(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  session_type text NOT NULL CHECK (session_type IN ('studying', 'watching_lecture', 'solving_questions', 'reviewing', 'reading', 'other')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  total_seconds integer NOT NULL DEFAULT 0 CHECK (total_seconds >= 0),
  effective_seconds integer NOT NULL DEFAULT 0 CHECK (effective_seconds >= 0),
  distraction_seconds integer NOT NULL DEFAULT 0 CHECK (distraction_seconds >= 0),
  break_seconds integer NOT NULL DEFAULT 0 CHECK (break_seconds >= 0),
  distraction_count integer NOT NULL DEFAULT 0 CHECK (distraction_count >= 0),
  focus_percentage numeric(5,2) NOT NULL DEFAULT 0 CHECK (focus_percentage >= 0 AND focus_percentage <= 100),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_study_sessions" ON study_sessions;
CREATE POLICY "select_own_study_sessions" ON study_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_study_sessions" ON study_sessions;
CREATE POLICY "insert_own_study_sessions" ON study_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_study_sessions" ON study_sessions;
CREATE POLICY "update_own_study_sessions" ON study_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_study_sessions" ON study_sessions;
CREATE POLICY "delete_own_study_sessions" ON study_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Prevent multiple active sessions per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_study_sessions_one_active_per_user
  ON study_sessions(user_id) WHERE status = 'active';

-- ============================================================
-- SESSION EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  study_session_id uuid NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('study', 'distraction', 'break')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  reason text CHECK (reason IS NULL OR reason IN ('phone', 'social_media', 'daydreaming', 'tired', 'food_drink', 'interruption', 'difficult_material', 'boredom', 'other')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_session_events" ON session_events;
CREATE POLICY "select_own_session_events" ON session_events FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_session_events" ON session_events;
CREATE POLICY "insert_own_session_events" ON session_events FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM study_sessions
      WHERE study_sessions.id = session_events.study_session_id
      AND study_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "update_own_session_events" ON session_events;
CREATE POLICY "update_own_session_events" ON session_events FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM study_sessions
      WHERE study_sessions.id = session_events.study_session_id
      AND study_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delete_own_session_events" ON session_events;
CREATE POLICY "delete_own_session_events" ON session_events FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_status ON study_sessions(status);
CREATE INDEX IF NOT EXISTS idx_study_sessions_started_at ON study_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_session_events_user_id ON session_events(user_id);
CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events(study_session_id);

-- ============================================================
-- TRIGGERS: updated_at on study_sessions
-- ============================================================
DROP TRIGGER IF EXISTS update_study_sessions_updated_at ON study_sessions;
CREATE TRIGGER update_study_sessions_updated_at
  BEFORE UPDATE ON study_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
/*
# Create goals table

1. New Tables
- `goals`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users)
  - `title` (text, optional custom title)
  - `goal_type` (text, not null) — one of: daily_effective_time, weekly_effective_time, monthly_effective_time, subject_effective_time, lessons_completed
  - `target_value` (numeric, not null) — target amount (seconds for time goals, count for lessons)
  - `subject_id` (uuid, nullable, references subjects) — required only for subject_effective_time goals
  - `start_date` (date, not null) — goal period start
  - `end_date` (date, not null) — goal period end
  - `status` (text, not null, default 'active') — one of: active, completed, expired
  - `created_at` (timestamptz, default now)
  - `updated_at` (timestamptz, default now)

2. Security
- Enable RLS on `goals`.
- Owner-scoped CRUD: each authenticated user can only access their own goals.
- `user_id` defaults to `auth.uid()` so inserts omitting it still succeed.

3. Indexes
- Index on `user_id` for fast per-user queries.
- Index on `status` for filtering active/completed/expired.
*/

CREATE TABLE IF NOT EXISTS goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  goal_type text NOT NULL CHECK (
    goal_type IN (
      'daily_effective_time',
      'weekly_effective_time',
      'monthly_effective_time',
      'subject_effective_time',
      'lessons_completed'
    )
  ),
  target_value numeric NOT NULL CHECK (target_value > 0),
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);

DROP POLICY IF EXISTS "select_own_goals" ON goals;
CREATE POLICY "select_own_goals" ON goals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_goals" ON goals;
CREATE POLICY "insert_own_goals" ON goals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_goals" ON goals;
CREATE POLICY "update_own_goals" ON goals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_goals" ON goals;
CREATE POLICY "delete_own_goals" ON goals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
/*
# Create exams and deadlines tables

1. New Tables
- `exams`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users)
  - `learning_path_id` (uuid, nullable, references learning_paths ON DELETE SET NULL)
  - `subject_id` (uuid, nullable, references subjects ON DELETE SET NULL)
  - `title` (text, not null)
  - `exam_date` (date, not null)
  - `start_time` (time, nullable)
  - `location` (text, nullable)
  - `created_at` (timestamptz, default now)
  - `updated_at` (timestamptz, default now)

- `deadlines`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users)
  - `learning_path_id` (uuid, nullable, references learning_paths ON DELETE SET NULL)
  - `subject_id` (uuid, nullable, references subjects ON DELETE SET NULL)
  - `title` (text, not null)
  - `due_date` (date, not null)
  - `due_time` (time, nullable)
  - `description` (text, nullable)
  - `status` (text, not null, default 'pending') — pending / completed
  - `created_at` (timestamptz, default now)
  - `updated_at` (timestamptz, default now)

2. Security
- Enable RLS on both tables.
- Owner-scoped CRUD: each authenticated user can only access their own exams and deadlines.
- `user_id` defaults to `auth.uid()` so inserts omitting it still succeed.

3. Indexes
- Index on `user_id` for both tables.
- Index on `exam_date` for sorting upcoming exams.
- Index on `due_date` for sorting upcoming deadlines.
- Index on `status` for deadlines filtering.
*/

CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  learning_path_id uuid REFERENCES learning_paths(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  title text NOT NULL,
  exam_date date NOT NULL,
  start_time time,
  location text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_exams_user_id ON exams(user_id);
CREATE INDEX IF NOT EXISTS idx_exams_exam_date ON exams(exam_date);

DROP POLICY IF EXISTS "select_own_exams" ON exams;
CREATE POLICY "select_own_exams" ON exams FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_exams" ON exams;
CREATE POLICY "insert_own_exams" ON exams FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_exams" ON exams;
CREATE POLICY "update_own_exams" ON exams FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_exams" ON exams;
CREATE POLICY "delete_own_exams" ON exams FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS deadlines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  learning_path_id uuid REFERENCES learning_paths(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  title text NOT NULL,
  due_date date NOT NULL,
  due_time time,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE deadlines ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_deadlines_user_id ON deadlines(user_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_due_date ON deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_deadlines_status ON deadlines(status);

DROP POLICY IF EXISTS "select_own_deadlines" ON deadlines;
CREATE POLICY "select_own_deadlines" ON deadlines FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_deadlines" ON deadlines;
CREATE POLICY "insert_own_deadlines" ON deadlines FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_deadlines" ON deadlines;
CREATE POLICY "update_own_deadlines" ON deadlines FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_deadlines" ON deadlines;
CREATE POLICY "delete_own_deadlines" ON deadlines FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
/*
# Phase 6: Study productivity tables

Creates 5 new tables for Lavender Lab Phase 6:
1. study_tasks — Daily study plan tasks
2. task_steps — Checklists within study tasks or lessons
3. schedule_entries — Recurring weekly university classes and study blocks
4. reviews — Spaced revision scheduling
5. mistakes — Mistake log and weak topic tracker

## New Tables

### 1. study_tasks
Daily study plan tasks. Each task belongs to a user and can optionally
link to a learning path, subject, and lesson.
- id (uuid, PK)
- user_id (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users ON DELETE CASCADE)
- learning_path_id (uuid, nullable, references learning_paths ON DELETE SET NULL)
- subject_id (uuid, nullable, references subjects ON DELETE SET NULL)
- lesson_id (uuid, nullable, references lessons ON DELETE SET NULL)
- title (text, NOT NULL)
- description (text, nullable)
- planned_date (date, NOT NULL)
- planned_duration (integer, nullable) — planned minutes
- status (text, NOT NULL DEFAULT 'pending') — CHECK: pending, completed
- carried_forward (boolean, DEFAULT false) — true if auto-carried from a previous date
- created_at, updated_at (timestamptz)

### 2. task_steps
Checklist steps within a study task or lesson. The parent_type column
determines whether the step belongs to a study_task or a lesson.
- id (uuid, PK)
- user_id (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users ON DELETE CASCADE)
- parent_type (text, NOT NULL) — CHECK: 'study_task', 'lesson'
- study_task_id (uuid, nullable, references study_tasks ON DELETE CASCADE)
- lesson_id (uuid, nullable, references lessons ON DELETE CASCADE)
- title (text, NOT NULL)
- order_index (integer, DEFAULT 0)
- completed (boolean, DEFAULT false)
- created_at, updated_at (timestamptz)
- CHECK: exactly one of study_task_id / lesson_id must be non-null

### 3. schedule_entries
Recurring weekly schedule entries for university classes and study blocks.
- id (uuid, PK)
- user_id (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users ON DELETE CASCADE)
- subject_id (uuid, nullable, references subjects ON DELETE SET NULL)
- title (text, NOT NULL)
- entry_type (text, NOT NULL DEFAULT 'class') — CHECK: 'class', 'study'
- day_of_week (smallint, NOT NULL) — CHECK: 0-6 (0=Sunday)
- start_time (time, NOT NULL)
- end_time (time, NOT NULL)
- location (text, nullable)
- created_at, updated_at (timestamptz)
- CHECK: end_time > start_time

### 4. reviews
Spaced revision scheduling linked to lessons and subjects.
- id (uuid, PK)
- user_id (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users ON DELETE CASCADE)
- subject_id (uuid, nullable, references subjects ON DELETE SET NULL)
- lesson_id (uuid, nullable, references lessons ON DELETE SET NULL)
- title (text, NOT NULL)
- review_date (date, NOT NULL)
- status (text, NOT NULL DEFAULT 'pending') — CHECK: pending, completed, skipped, cancelled
- confidence (text, nullable) — CHECK: 'difficult', 'partial', 'understood'
- next_review_date (date, nullable) — for rescheduling chain
- created_at, updated_at (timestamptz)

### 5. mistakes
Mistake log and weak topic tracker.
- id (uuid, PK)
- user_id (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users ON DELETE CASCADE)
- subject_id (uuid, nullable, references subjects ON DELETE SET NULL)
- lesson_id (uuid, nullable, references lessons ON DELETE SET NULL)
- title (text, NOT NULL)
- topic (text, nullable)
- category (text, NOT NULL DEFAULT 'other') — CHECK: conceptual, formula, calculation, misreading, forgotten, other
- explanation (text, nullable)
- correct_approach (text, nullable)
- follow_up_date (date, nullable)
- status (text, NOT NULL DEFAULT 'unresolved') — CHECK: unresolved, resolved
- created_at, updated_at (timestamptz)

## Security
- RLS enabled on ALL 5 tables.
- Each table has 4 owner-scoped policies (SELECT, INSERT, UPDATE, DELETE)
  scoped to authenticated users via auth.uid() = user_id.
- user_id defaults to auth.uid() so frontend inserts omitting it still pass WITH CHECK.

## Indexes
- study_tasks: user_id, planned_date, status
- task_steps: user_id, study_task_id, lesson_id
- schedule_entries: user_id, day_of_week
- reviews: user_id, review_date, status
- mistakes: user_id, status, category

## Important Notes
1. All foreign keys to subjects/lessons/learning_paths use ON DELETE SET NULL
   so deleting a subject or lesson does not break related tasks/reviews/mistakes.
2. task_steps has a CHECK constraint ensuring exactly one parent is set.
3. schedule_entries has a CHECK ensuring end_time > start_time.
4. Triggers for updated_at are added on all 5 tables reusing the existing update_updated_at() function.
*/

-- ============================================================
-- STUDY TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS study_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  learning_path_id uuid REFERENCES learning_paths(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  planned_date date NOT NULL,
  planned_duration integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  carried_forward boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE study_tasks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_study_tasks_user_id ON study_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_study_tasks_planned_date ON study_tasks(planned_date);
CREATE INDEX IF NOT EXISTS idx_study_tasks_status ON study_tasks(status);

DROP POLICY IF EXISTS "select_own_study_tasks" ON study_tasks;
CREATE POLICY "select_own_study_tasks" ON study_tasks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_study_tasks" ON study_tasks;
CREATE POLICY "insert_own_study_tasks" ON study_tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_study_tasks" ON study_tasks;
CREATE POLICY "update_own_study_tasks" ON study_tasks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_study_tasks" ON study_tasks;
CREATE POLICY "delete_own_study_tasks" ON study_tasks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- TASK STEPS
-- ============================================================
CREATE TABLE IF NOT EXISTS task_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_type text NOT NULL CHECK (parent_type IN ('study_task', 'lesson')),
  study_task_id uuid REFERENCES study_tasks(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  title text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (study_task_id IS NOT NULL AND lesson_id IS NULL) OR
    (study_task_id IS NULL AND lesson_id IS NOT NULL)
  )
);

ALTER TABLE task_steps ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_task_steps_user_id ON task_steps(user_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_study_task_id ON task_steps(study_task_id);
CREATE INDEX IF NOT EXISTS idx_task_steps_lesson_id ON task_steps(lesson_id);

DROP POLICY IF EXISTS "select_own_task_steps" ON task_steps;
CREATE POLICY "select_own_task_steps" ON task_steps FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_task_steps" ON task_steps;
CREATE POLICY "insert_own_task_steps" ON task_steps FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_task_steps" ON task_steps;
CREATE POLICY "update_own_task_steps" ON task_steps FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_task_steps" ON task_steps;
CREATE POLICY "delete_own_task_steps" ON task_steps FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- SCHEDULE ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS schedule_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  title text NOT NULL,
  entry_type text NOT NULL DEFAULT 'class' CHECK (entry_type IN ('class', 'study')),
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_schedule_entries_user_id ON schedule_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_entries_day_of_week ON schedule_entries(day_of_week);

DROP POLICY IF EXISTS "select_own_schedule_entries" ON schedule_entries;
CREATE POLICY "select_own_schedule_entries" ON schedule_entries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_schedule_entries" ON schedule_entries;
CREATE POLICY "insert_own_schedule_entries" ON schedule_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_schedule_entries" ON schedule_entries;
CREATE POLICY "update_own_schedule_entries" ON schedule_entries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_schedule_entries" ON schedule_entries;
CREATE POLICY "delete_own_schedule_entries" ON schedule_entries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  title text NOT NULL,
  review_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped', 'cancelled')),
  confidence text CHECK (confidence IS NULL OR confidence IN ('difficult', 'partial', 'understood')),
  next_review_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_review_date ON reviews(review_date);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);

DROP POLICY IF EXISTS "select_own_reviews" ON reviews;
CREATE POLICY "select_own_reviews" ON reviews FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_reviews" ON reviews;
CREATE POLICY "insert_own_reviews" ON reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_reviews" ON reviews;
CREATE POLICY "update_own_reviews" ON reviews FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_reviews" ON reviews;
CREATE POLICY "delete_own_reviews" ON reviews FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- MISTAKES
-- ============================================================
CREATE TABLE IF NOT EXISTS mistakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL,
  title text NOT NULL,
  topic text,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('conceptual', 'formula', 'calculation', 'misreading', 'forgotten', 'other')),
  explanation text,
  correct_approach text,
  follow_up_date date,
  status text NOT NULL DEFAULT 'unresolved' CHECK (status IN ('unresolved', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mistakes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_mistakes_user_id ON mistakes(user_id);
CREATE INDEX IF NOT EXISTS idx_mistakes_status ON mistakes(status);
CREATE INDEX IF NOT EXISTS idx_mistakes_category ON mistakes(category);

DROP POLICY IF EXISTS "select_own_mistakes" ON mistakes;
CREATE POLICY "select_own_mistakes" ON mistakes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_mistakes" ON mistakes;
CREATE POLICY "insert_own_mistakes" ON mistakes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_mistakes" ON mistakes;
CREATE POLICY "update_own_mistakes" ON mistakes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_mistakes" ON mistakes;
CREATE POLICY "delete_own_mistakes" ON mistakes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGERS: updated_at for all 5 new tables
-- ============================================================
DROP TRIGGER IF EXISTS update_study_tasks_updated_at ON study_tasks;
CREATE TRIGGER update_study_tasks_updated_at
  BEFORE UPDATE ON study_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_task_steps_updated_at ON task_steps;
CREATE TRIGGER update_task_steps_updated_at
  BEFORE UPDATE ON task_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_schedule_entries_updated_at ON schedule_entries;
CREATE TRIGGER update_schedule_entries_updated_at
  BEFORE UPDATE ON schedule_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_mistakes_updated_at ON mistakes;
CREATE TRIGGER update_mistakes_updated_at
  BEFORE UPDATE ON mistakes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
-- Revoke EXECUTE on handle_new_user() from PUBLIC so anon/authenticated
-- can no longer call it via /rest/v1/rpc/handle_new_user.
-- The trigger on auth.users still works because triggers execute as the
-- function owner (SECURITY DEFINER), not through role grants.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
-- ============================================================
-- SUPPLEMENT: updated_at triggers for goals, exams, deadlines
-- These three tables were created without BEFORE UPDATE triggers,
-- so their updated_at column never refreshed automatically.
-- Added here for parity with the other 11 tables. Uses the existing
-- public.update_updated_at() SECURITY DEFINER function.
-- ============================================================
DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_exams_updated_at ON exams;
CREATE TRIGGER update_exams_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_deadlines_updated_at ON deadlines;
CREATE TRIGGER update_deadlines_updated_at
  BEFORE UPDATE ON deadlines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
/*
# Fix task_steps RLS: verify parent ownership

## Problem
The INSERT and UPDATE policies on task_steps only checked auth.uid() = user_id.
They did NOT verify that the referenced parent (study_task or lesson) belongs
to the same user. A malicious authenticated user could create a task_step
pointing at another user's study_task_id or lesson_id, potentially leaking
parent metadata through cascading reads or future joins.

## Fix
Replaces the INSERT and UPDATE policies with versions that additionally check:
- When parent_type = 'study_task': the study_tasks row referenced by
  study_task_id must have user_id = auth.uid().
- When parent_type = 'lesson': the lessons row referenced by lesson_id
  must have user_id = auth.uid().

The SELECT and DELETE policies are unchanged — they already filter by
auth.uid() = user_id, so a user can only see/delete their own task_steps.
The UPDATE policy's USING clause is also unchanged (only owner can update),
but the WITH CHECK now also validates the parent.

## Tables affected
- task_steps (RLS policies only — no schema changes)

## Notes
1. Safe to re-run: uses DROP POLICY IF EXISTS before each CREATE.
2. No data loss: no columns changed, no tables dropped.
3. No application code changes needed — the frontend already only sends
   study_task_id / lesson_id from the user's own data.
*/

-- ============================================================
-- Replace INSERT policy: verify parent ownership + user_id
-- ============================================================
DROP POLICY IF EXISTS "insert_own_task_steps" ON task_steps;
CREATE POLICY "insert_own_task_steps" ON task_steps FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (parent_type = 'study_task' AND study_task_id IS NOT NULL AND lesson_id IS NULL
       AND EXISTS (
         SELECT 1 FROM study_tasks
         WHERE study_tasks.id = task_steps.study_task_id
           AND study_tasks.user_id = auth.uid()
       ))
      OR
      (parent_type = 'lesson' AND lesson_id IS NOT NULL AND study_task_id IS NULL
       AND EXISTS (
         SELECT 1 FROM lessons
         WHERE lessons.id = task_steps.lesson_id
           AND lessons.user_id = auth.uid()
       ))
    )
  );

-- ============================================================
-- Replace UPDATE policy: verify parent ownership in WITH CHECK
-- ============================================================
DROP POLICY IF EXISTS "update_own_task_steps" ON task_steps;
CREATE POLICY "update_own_task_steps" ON task_steps FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (parent_type = 'study_task' AND study_task_id IS NOT NULL AND lesson_id IS NULL
       AND EXISTS (
         SELECT 1 FROM study_tasks
         WHERE study_tasks.id = task_steps.study_task_id
           AND study_tasks.user_id = auth.uid()
       ))
      OR
      (parent_type = 'lesson' AND lesson_id IS NOT NULL AND study_task_id IS NULL
       AND EXISTS (
         SELECT 1 FROM lessons
         WHERE lessons.id = task_steps.lesson_id
           AND lessons.user_id = auth.uid()
       ))
    )
  );
