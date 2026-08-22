import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sitemap from '../app/sitemap';
import {
  courseLessons,
  stageLessons,
  TEACHING_COURSES,
  TEACHING_LESSON_COUNT,
  TEACHING_TOTAL_MINUTES,
} from '../app/[lang]/courses/_data';
import { OLL_ORDER, PLL_LABELS, ZBLL_CASE_COUNTS } from '../app/[lang]/courses/_data/cfop-micro';
import { ADVANCED_COURSE_FALLBACK } from '../app/[lang]/courses/_data/advanced-course-fallback';
import { mergeTrialLessonOverrides } from '../app/[lang]/courses/_data/trial-overrides';
import { SECTIONS, TEXTS } from '../lib/landing-sections';

describe('teaching course plan', () => {
  it('keeps the three-course lesson structure and duration baseline', () => {
    expect(TEACHING_COURSES.map((course) => courseLessons(course).length)).toEqual([9, 26, 588]);
    expect(TEACHING_LESSON_COUNT).toBe(623);
    expect(TEACHING_TOTAL_MINUTES).toBe(1734);

    const cfop = TEACHING_COURSES[2];
    expect(cfop.stages.map((stage) => stageLessons(stage).length)).toEqual([3, 15, 73, 483, 14]);
    expect(TEACHING_COURSES.map((course) => (
      course.stages.reduce((total, stage) => total + stage.modules.length, 0)
    ))).toEqual([1, 5, 19]);

    const lessons = TEACHING_COURSES.flatMap(courseLessons);
    expect(new Set(lessons.map((lesson) => lesson.id)).size).toBe(lessons.length);
    for (const lesson of lessons) {
      expect(lesson.minutes).toBeGreaterThanOrEqual(1);
      expect(lesson.minutes).toBeLessThanOrEqual(5);
      expect(lesson.shots.length).toBeGreaterThanOrEqual(3);
      expect(lesson.script.length).toBeGreaterThanOrEqual(7);
      for (const field of [lesson.title, lesson.outcome, ...lesson.shots, ...lesson.script]) {
        expect(field.zh.trim()).not.toBe('');
        expect(field.en.trim()).not.toBe('');
        expect(field.en).not.toMatch(/[\u3400-\u9fff]/);
      }
    }

    const ids = TEACHING_COURSES.flatMap((course) => course.stages.flatMap((stage) => [
      stage.id,
      ...stage.modules.map((module) => module.id),
    ]));
    expect(new Set(ids).size).toBe(ids.length);

    for (const course of TEACHING_COURSES) {
      for (const field of [course.label, course.title, course.summary, course.audience]) {
        expect(field.en).not.toMatch(/[\u3400-\u9fff]/);
      }
      for (const stage of course.stages) {
        expect(stage.title.en).not.toMatch(/[\u3400-\u9fff]/);
        expect(stage.summary.en).not.toMatch(/[\u3400-\u9fff]/);
        for (const courseModule of stage.modules) {
          expect(courseModule.title.en).not.toMatch(/[\u3400-\u9fff]/);
          expect(courseModule.summary.en).not.toMatch(/[\u3400-\u9fff]/);
        }
      }
    }
  });

  it('starts the trial with four introduction lessons and applies bilingual overrides', () => {
    const trial = TEACHING_COURSES[0];
    expect(courseLessons(trial).slice(0, 4).map((lesson) => lesson.id)).toEqual([
      'trial-intro-speedcubing',
      'trial-intro-ruimin',
      'trial-intro-cuberoot',
      'trial-intro-structure',
    ]);

    const original = courseLessons(trial)[0];
    const merged = courseLessons(mergeTrialLessonOverrides(trial, [{
      lessonId: original.id,
      titleZh: '修改后的标题',
      outcomeZh: '修改后的目标',
      minutes: 4,
      shotsZh: ['镜头一', '镜头二'],
      scriptZh: ['第一段', '第二段'],
    }]))[0];
    expect(merged).toMatchObject({
      title: { zh: '修改后的标题', en: original.title.en },
      outcome: { zh: '修改后的目标', en: original.outcome.en },
      minutes: 4,
    });
    expect(merged.shots.map((line) => line.zh)).toEqual(['镜头一', '镜头二']);
    expect(merged.script.map((line) => line.zh)).toEqual(['第一段', '第二段']);

    const bilingual = courseLessons(mergeTrialLessonOverrides(trial, [{
      lessonId: original.id,
      titleZh: '修改后的标题',
      outcomeZh: '修改后的目标',
      titleEn: 'Updated title',
      outcomeEn: 'Updated goal',
      minutes: 4,
      shotsZh: ['镜头一', '镜头二'],
      shotsEn: ['Shot one', 'Shot two'],
      scriptZh: ['第一段', '第二段'],
      scriptEn: ['Paragraph one', 'Paragraph two'],
      needsEnglishSync: false,
    }]))[0];
    expect(bilingual.title.en).toBe('Updated title');
    expect(bilingual.outcome.en).toBe('Updated goal');
    expect(bilingual.shots.map((line) => line.en)).toEqual(['Shot one', 'Shot two']);
    expect(bilingual.script.map((line) => line.en)).toEqual(['Paragraph one', 'Paragraph two']);
  });

  it('keeps trial writes administrator-only and stores JSON arrays without double encoding', () => {
    const route = readFileSync(join(import.meta.dirname, '../../server/src/routes/teaching.ts'), 'utf8');
    expect(route).toMatch(/put\('\/teaching\/trial\/:lessonId'[\s\S]*?requireAdminOrApiKey\(c\)/);
    expect(route).toMatch(/put\('\/teaching\/trial\/:lessonId\/english'[\s\S]*?requireAdminOrApiKey\(c\)/);
    expect(route).toMatch(/shots_zh = EXCLUDED\.shots_zh/);
    expect(route).toMatch(/english_stale = TRUE/);
    expect(route).toMatch(/english_stale = FALSE/);
    expect(route).toMatch(/content_revision = \?/);
    expect(route).toMatch(/content_revision = teaching_trial_lesson_overrides\.content_revision \+ 1/);
    expect(route).toMatch(/\[lessonId,[\s\S]*lesson\.shotsZh, lesson\.scriptZh\]/);
  });

  it('keeps the complete reference-inspired CFOP case tree', () => {
    const cfopLessons = courseLessons(TEACHING_COURSES[2]);
    const ids = cfopLessons.map((lesson) => lesson.id);

    expect(ids.filter((id) => /^cfop-coll-(u|t|l|h|pi)-\d+$/.test(id))).toHaveLength(28);
    expect(ids.filter((id) => /^cfop-zbll-(u|t|l|h|pi)-\d+-\d+$/.test(id))).toHaveLength(328);
    expect(Object.values(ZBLL_CASE_COUNTS).flat().reduce((sum, count) => sum + count, 0)).toBe(328);

    expect(cfopLessons.filter((lesson) => lesson.id.startsWith('cfop-advanced-oll-') && lesson.id !== 'cfop-advanced-oll-intro').map((lesson) => Number(lesson.id.split('-').at(-1)))).toEqual(OLL_ORDER);
    expect(cfopLessons.filter((lesson) => lesson.id.startsWith('cfop-intermediate-pll-') && lesson.id !== 'cfop-intermediate-pll-intro').map((lesson) => lesson.title.en.replace('PLL ', ''))).toEqual(PLL_LABELS);

    expect(ids.indexOf('cfop-advanced-f2l-18')).toBeLessThan(ids.indexOf('cfop-advanced-f2l-free-slot'));
    expect(ids.indexOf('cfop-advanced-f2l-free-slot')).toBeLessThan(ids.indexOf('cfop-advanced-f2l-19'));
    expect(ids.indexOf('cfop-finish-01')).toBeLessThan(ids.indexOf('cfop-sheet-01'));
  });

  it('keeps age restrictions out of the teaching page', () => {
    const content = JSON.stringify({ courses: TEACHING_COURSES, advanced: ADVANCED_COURSE_FALLBACK });
    expect(content).not.toMatch(/\d+\s*岁|岁以上|岁以下|周岁|年龄/);
    expect(content).not.toMatch(/\bage(?:d|s)?\b|\byears?[- ]old\b|\bolder than\b|\byounger than\b/i);
  });

  it('keeps the post-CFOP fallback aligned with the seeded course tracks', () => {
    expect(ADVANCED_COURSE_FALLBACK.filter((lesson) => lesson.track === '333')).toHaveLength(48);
    expect(ADVANCED_COURSE_FALLBACK.filter((lesson) => lesson.track === '222')).toHaveLength(10);
    expect(new Set(ADVANCED_COURSE_FALLBACK.map((lesson) => lesson.id)).size).toBe(58);
    for (const lesson of ADVANCED_COURSE_FALLBACK) {
      expect(lesson.titleZh.trim()).not.toBe('');
      expect(lesson.titleEn.trim()).not.toBe('');
      expect(lesson.titleEn).not.toMatch(/[\u3400-\u9fff]/);
      expect(lesson.minutes).toBeGreaterThanOrEqual(1);
      expect(lesson.minutes).toBeLessThanOrEqual(60);
    }

    const migration = readFileSync(
      join(import.meta.dirname, '../../server/migrations/0127_teaching_advanced_lessons.sql'),
      'utf8',
    );
    const seeded = [...migration.matchAll(/^\s*\('(333|222)',\s*(\d+),\s*'([^']*)',\s*'([^']*)'\)[,;]$/gm)]
      .map((match) => ({
        track: match[1],
        position: Number(match[2]),
        titleZh: match[3],
        titleEn: match[4],
      }));
    expect(seeded).toEqual(ADVANCED_COURSE_FALLBACK.map(({ track, position, titleZh, titleEn }) => ({
      track,
      position,
      titleZh,
      titleEn,
    })));
  });

  it('publishes the canonical courses entry on the homepage', () => {
    const teachingCard = SECTIONS
      .flatMap((section) => section.cards)
      .find((card) => card.id === 'teaching');

    expect(teachingCard).toMatchObject({
      href: '/courses',
      internal: true,
    });
    expect(teachingCard?.adminOnly).toBeUndefined();
    expect(TEXTS.teaching).toEqual({ zh: '课程', en: 'Courses' });
  });

  it('keeps the administrator-only page out of the sitemap', () => {
    const entries = sitemap();
    const courseEntries = entries.filter((entry) => entry.url.endsWith('/courses'));
    expect(courseEntries).toEqual([]);
  });
});
