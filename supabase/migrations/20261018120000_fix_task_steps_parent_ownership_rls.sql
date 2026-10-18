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
