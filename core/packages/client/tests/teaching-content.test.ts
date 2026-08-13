import { describe, expect, it } from 'vitest';
import sitemap from '../app/sitemap';
import {
  TEACHING_COURSES,
  TEACHING_LESSON_COUNT,
  TEACHING_TOTAL_MINUTES,
} from '../app/[lang]/teaching/_data';
import { SECTIONS } from '../lib/landing-sections';

describe('teaching course plan', () => {
  it('keeps the promised course size and child-sized lesson range', () => {
    expect(TEACHING_COURSES.map((course) => course.lessons.length)).toEqual([3, 13, 22]);
    expect(TEACHING_LESSON_COUNT).toBe(38);
    expect(TEACHING_TOTAL_MINUTES).toBe(339);

    const lessons = TEACHING_COURSES.flatMap((course) => course.lessons);
    expect(new Set(lessons.map((lesson) => lesson.id)).size).toBe(lessons.length);
    for (const lesson of lessons) {
      expect(lesson.minutes).toBeGreaterThanOrEqual(5);
      expect(lesson.minutes).toBeLessThanOrEqual(15);
      expect(lesson.shots.length).toBeGreaterThanOrEqual(3);
      expect(lesson.script.length).toBeGreaterThanOrEqual(4);
    }

    const formulaLessonIds = lessons
      .filter((lesson) => lesson.formulas?.length)
      .map((lesson) => lesson.id);
    expect(formulaLessonIds).toEqual([
      'cfop-16', 'cfop-17', 'cfop-18', 'cfop-19', 'cfop-20', 'cfop-21',
    ]);
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
