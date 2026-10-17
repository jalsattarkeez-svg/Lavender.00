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
