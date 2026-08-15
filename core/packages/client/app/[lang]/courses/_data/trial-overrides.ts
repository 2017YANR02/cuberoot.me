import type { TrialLessonOverride } from '@/lib/teaching-api';
import type { LocalizedText, MicroCourse } from './types';

function localizedLines(zhLines: string[], enLines: string[] | null | undefined, current: LocalizedText[]): LocalizedText[] {
  return zhLines.map((zh, index) => ({ zh, en: enLines?.[index] ?? current[index]?.en ?? '' }));
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
            title: { zh: override.titleZh, en: override.titleEn?.trim() || lesson.title.en },
            outcome: { zh: override.outcomeZh, en: override.outcomeEn?.trim() || lesson.outcome.en },
            minutes: override.minutes,
            shots: localizedLines(override.shotsZh, override.shotsEn, lesson.shots),
            script: localizedLines(override.scriptZh, override.scriptEn, lesson.script),
          };
        }),
      })),
    })),
  };
}
