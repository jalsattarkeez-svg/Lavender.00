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
