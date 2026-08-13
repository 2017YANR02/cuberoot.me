import { describe, expect, it } from 'vitest';
import sitemap from '../app/sitemap';
import {
  courseLessons,
  stageLessons,
  TEACHING_COURSES,
  TEACHING_LESSON_COUNT,
  TEACHING_TOTAL_MINUTES,
} from '../app/[lang]/teaching/_data';
import { SECTIONS } from '../lib/landing-sections';

describe('teaching course plan', () => {
  it('keeps the three-course micro-lesson structure and duration baseline', () => {
    expect(TEACHING_COURSES.map((course) => courseLessons(course).length)).toEqual([5, 24, 242]);
    expect(TEACHING_LESSON_COUNT).toBe(271);
    expect(TEACHING_TOTAL_MINUTES).toBe(694);

    const cfop = TEACHING_COURSES[2];
    expect(cfop.stages.map((stage) => stageLessons(stage).length)).toEqual([3, 15, 73, 136, 15]);
    expect(TEACHING_COURSES.map((course) => (
      course.stages.reduce((total, stage) => total + stage.modules.length, 0)
    ))).toEqual([1, 5, 18]);

    const lessons = TEACHING_COURSES.flatMap(courseLessons);
    expect(new Set(lessons.map((lesson) => lesson.id)).size).toBe(lessons.length);
    for (const lesson of lessons) {
      expect(lesson.minutes).toBeGreaterThanOrEqual(1);
      expect(lesson.minutes).toBeLessThanOrEqual(5);
      expect(lesson.shots.length).toBeGreaterThanOrEqual(3);
      expect(lesson.script.length).toBeGreaterThanOrEqual(5);
    }

    const ids = TEACHING_COURSES.flatMap((course) => course.stages.flatMap((stage) => [
      stage.id,
      ...stage.modules.map((module) => module.id),
    ]));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('marks the homepage entry as administrator-only', () => {
    const teachingCard = SECTIONS
      .flatMap((section) => section.cards)
      .find((card) => card.id === 'teaching');

    expect(teachingCard).toMatchObject({
      href: '/teaching',
      internal: true,
      adminOnly: true,
    });
  });

  it('keeps the administrator-only page out of the sitemap', () => {
    const entries = sitemap();
    const teachingEntries = entries.filter((entry) => entry.url.endsWith('/teaching'));
    expect(teachingEntries).toEqual([]);
  });
});
