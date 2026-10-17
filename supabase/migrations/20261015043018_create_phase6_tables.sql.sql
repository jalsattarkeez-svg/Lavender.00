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
