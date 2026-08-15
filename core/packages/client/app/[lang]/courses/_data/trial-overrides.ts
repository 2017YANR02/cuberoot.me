import type { TrialLessonOverride } from '@/lib/teaching-api';
import type { LocalizedText, MicroCourse } from './types';

function chineseLines(lines: string[], current: LocalizedText[]): LocalizedText[] {
  return lines.map((zh, index) => ({ zh, en: current[index]?.en ?? '' }));
}

export function mergeTrialLessonOverrides(
  course: MicroCourse,
  overrides: TrialLessonOverride[],
): MicroCourse {
  const byId = new Map(overrides.map((override) => [override.lessonId, override]));
  return {
    ...course,
    stages: course.stages.map((stage) => ({
      ...stage,
      modules: stage.modules.map((courseModule) => ({
        ...courseModule,
        lessons: courseModule.lessons.map((lesson) => {
          const override = byId.get(lesson.id);
          if (!override) return lesson;
          return {
            ...lesson,
            title: { ...lesson.title, zh: override.titleZh },
            outcome: { ...lesson.outcome, zh: override.outcomeZh },
            minutes: override.minutes,
            shots: chineseLines(override.shotsZh, lesson.shots),
            script: chineseLines(override.scriptZh, lesson.script),
          };
        }),
      })),
    })),
  };
}
