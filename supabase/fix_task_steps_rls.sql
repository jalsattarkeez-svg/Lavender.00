/*
# Fix task_steps RLS — parent ownership verification
# Standalone corrective script (applies ONLY to task_steps policies)

## Purpose
Run this on the NEW Supabase project after the main schema is applied.
It replaces only the INSERT and UPDATE policies on task_steps to add
parent-ownership checks. No tables, columns, triggers, or other policies
are touched.

## Schema reference (task_steps)
  id            uuid PK
  user_id       uuid NOT NULL DEFAULT auth.uid() → auth.users(id)
  parent_type   text NOT NULL  CHECK IN ('study_task', 'lesson')
  study_task_id uuid nullable  → study_tasks(id) ON DELETE CASCADE
  lesson_id     uuid nullable  → lessons(id)     ON DELETE CASCADE
  title         text NOT NULL
  order_index   integer DEFAULT 0
  completed     boolean DEFAULT false
  created_at    timestamptz
  updated_at    timestamptz
  CHECK: exactly one of (study_task_id, lesson_id) is non-null

## What changes
  INSERT  → WITH CHECK now also requires the parent (study_task or lesson)
            to belong to auth.uid().
  UPDATE  → USING unchanged (owner-only). WITH CHECK now also requires
            the parent to belong to auth.uid().
  SELECT  → unchanged (auth.uid() = user_id)
  DELETE  → unchanged (auth.uid() = user_id)

## Re-run safety
  Every policy uses DROP POLICY IF EXISTS before CREATE.
  No schema changes → safe to run multiple times.
*/

-- ============================================================
-- INSERT: verify user_id AND parent ownership
-- ============================================================
DROP POLICY IF EXISTS "insert_own_task_steps" ON task_steps;
CREATE POLICY "insert_own_task_steps" ON task_steps FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (parent_type = 'study_task'
       AND study_task_id IS NOT NULL
       AND lesson_id IS NULL
       AND EXISTS (
         SELECT 1 FROM study_tasks
         WHERE study_tasks.id = task_steps.study_task_id
           AND study_tasks.user_id = auth.uid()
       ))
      OR
      (parent_type = 'lesson'
       AND lesson_id IS NOT NULL
       AND study_task_id IS NULL
       AND EXISTS (
         SELECT 1 FROM lessons
         WHERE lessons.id = task_steps.lesson_id
           AND lessons.user_id = auth.uid()
       ))
    )
  );

-- ============================================================
-- UPDATE: keep owner-only USING, add parent ownership to WITH CHECK
-- ============================================================
DROP POLICY IF EXISTS "update_own_task_steps" ON task_steps;
CREATE POLICY "update_own_task_steps" ON task_steps FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      (parent_type = 'study_task'
       AND study_task_id IS NOT NULL
       AND lesson_id IS NULL
       AND EXISTS (
         SELECT 1 FROM study_tasks
         WHERE study_tasks.id = task_steps.study_task_id
           AND study_tasks.user_id = auth.uid()
       ))
      OR
      (parent_type = 'lesson'
       AND lesson_id IS NOT NULL
       AND study_task_id IS NULL
       AND EXISTS (
         SELECT 1 FROM lessons
         WHERE lessons.id = task_steps.lesson_id
           AND lessons.user_id = auth.uid()
       ))
    )
  );
