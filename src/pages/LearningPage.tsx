import { useState } from 'react';
import { LearningPathList } from '@/components/learning/LearningPathList';
import { SubjectList } from '@/components/learning/SubjectList';
import { LessonList } from '@/components/learning/LessonList';
import type { LearningPathWithCounts, SubjectWithProgress } from '@/types/database';

type View =
  | { level: 'paths' }
  | { level: 'subjects'; path: LearningPathWithCounts }
  | { level: 'lessons'; path: LearningPathWithCounts; subject: SubjectWithProgress };

export function LearningPage() {
  const [view, setView] = useState<View>({ level: 'paths' });

  if (view.level === 'paths') {
    return (
      <LearningPathList
        onOpen={(path) => setView({ level: 'subjects', path })}
      />
    );
  }

  if (view.level === 'subjects') {
    return (
      <SubjectList
        learningPath={view.path}
        onOpen={(subject) => setView({ level: 'lessons', path: view.path, subject })}
        onBack={() => setView({ level: 'paths' })}
      />
    );
  }

  return (
    <LessonList
      subject={view.subject}
      onBack={() => setView({ level: 'subjects', path: view.path })}
    />
  );
}
