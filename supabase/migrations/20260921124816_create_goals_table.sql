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
