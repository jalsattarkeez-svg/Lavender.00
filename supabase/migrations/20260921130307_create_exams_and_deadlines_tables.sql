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
