// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { PlatformResource } from '@/lib/platform-types';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';

const mocks = vi.hoisted(() => ({
  stage: vi.fn(),
  user: { uid: 1, name: '学员' } as { uid: number; name: string } | null,
  teachers: vi.fn(),
  load: vi.fn(),
  media: vi.fn(),
  slides: vi.fn(),
  settings: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock('@/lib/platform-stage-preference', () => ({ accountLearningStage: mocks.stage }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => mocks.user, useIsAdmin: () => false, getSessionToken: () => null, nextQuery: (path: string) => `?next=${encodeURIComponent(path)}` }));
vi.mock('@/lib/teacher-directory-api', () => ({ fetchTeacherDirectory: mocks.teachers }));
vi.mock('@/lib/teaching-saas-api', () => ({ listTeachingLearningContexts: vi.fn(), listTeachingOrganizations: vi.fn() }));
vi.mock('@/lib/platform-gateway', () => ({ loadPlatformResource: mocks.load, loadPlatformLessonMedia: mocks.media, platformMediaBrowserUrl: (url: string) => url, PlatformPermissionError: class extends Error {} }));
vi.mock('@/lib/platform-homepage', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/platform-homepage')>(), loadHomepageSlides: mocks.slides, loadHomepageSettings: mocks.settings, saveHomepageSettings: mocks.saveSettings }));
vi.mock('@/components/AppLink', () => ({ default: ({ prefetch: _prefetch, children, ...props }: React.ComponentProps<'a'> & { prefetch?: boolean; children: ReactNode }) => createElement('a', props, children) }));
vi.mock('next/image', () => ({ default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => createElement('img', { src, alt, className }) }));

import { learningStages } from '@/lib/platform-learning-path';
import { PlatformLanding } from '@/components/platform/PlatformLanding';
import PlatformPage from '@/app/[lang]/platform/page';
import { courseCatalogDetails, matchesCourseCatalog } from '@/lib/platform-course-catalog';
import { PlatformHomepageAdmin } from '@/components/platform/PlatformHomepageAdmin';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function landingWithQueryState(searchParams?: string, onUrlUpdate?: () => void) {
  return createElement(NuqsTestingAdapter, { hasMemory: true, searchParams, onUrlUpdate, children: createElement(PlatformLanding) });
}

beforeEach(() => {
  mocks.user = { uid: 1, name: '学员' };
  mocks.stage.mockReset().mockImplementation(async (_signal, stage) => stage ?? null);
  mocks.teachers.mockReset().mockResolvedValue([]);
  mocks.load.mockReset().mockResolvedValue({ items: [] });
  mocks.media.mockReset().mockResolvedValue({ posterUrl: null });
  mocks.slides.mockReset().mockResolvedValue([]);
  mocks.settings.mockReset().mockResolvedValue({ settings: { featuredItems: [], sections: [] }, content: [] });
  mocks.saveSettings.mockReset().mockImplementation(async settings => ({ settings }));
});

it('prerenders the actual guest homepage without waiting for JavaScript or network data', () => {
  mocks.user = null;
  const host = document.createElement('div');
  host.innerHTML = renderToString(createElement(NuqsTestingAdapter, { children: createElement(PlatformPage) }));
  expect(host.querySelector('.platform-home-hero h1')?.textContent).toContain('从第一次复原');
  const action = host.querySelector('.platform-home-hero .platform-button-primary');
  expect(action?.textContent).toContain('免费试听第一课');
  expect(action?.getAttribute('href')).toBe('/platform/courses?trial=1');
  expect(host.querySelector('a[href^="/account?"]')?.textContent).toBe('登录 / 注册');
  expect(host.querySelectorAll('.path-grid li')).toHaveLength(6);
  expect(host.textContent).not.toContain('正在加载');
  expect(mocks.load).not.toHaveBeenCalled();
  expect(host.querySelectorAll('.path-stage')).toHaveLength(6);
  expect(host.querySelector('.path-grid a')).toBeNull();
});

it('uses the resume-shaped skeleton and leaves the learning path rendered while personal data is pending', () => {
  const host = document.createElement('div');
  host.innerHTML = renderToString(landingWithQueryState());
  expect(host.querySelector('.platform-home-resume-skeleton')).not.toBeNull();
  expect(host.querySelectorAll('.path-grid li')).toHaveLength(6);
  expect(host.querySelector('.platform-home-hero')).toBeNull();
});

it('filters actual trial candidates and distinct speed goals rather than adding ignored URL parameters', () => {
  const course = { id: '60', title: '稳定 60 秒课程', data: { presentation: { tags: ['topic:speed'], trialLessonIds: ['trial'] } } };
  const details = courseCatalogDetails(course);
  expect(matchesCourseCatalog(course, details, { q: '60', puzzle: '', category: 'speed', trialOnly: true })).toBe(true);
  expect(matchesCourseCatalog(course, details, { q: '30', puzzle: '', category: 'speed', trialOnly: true })).toBe(false);
  const noTrial = { ...course, data: { presentation: { tags: ['topic:speed'], trialLessonIds: [] } } };
  expect(matchesCourseCatalog(noTrial, courseCatalogDetails(noTrial), { q: '60', puzzle: '', category: 'speed', trialOnly: true })).toBe(false);
});

it.each([false, true])('offers a direct first free lesson to a new user (signed in=%s)', async signedIn => {
  mocks.user = signedIn ? { uid: 1, name: '新学员' } : null;
  const course = { id: 'trial-course', status: 'published', title: '入门课程', data: { presentation: { trialLessonIds: ['trial-lesson'] }, lessons: [{ id: 'trial-lesson', accessScope: 'public', titleZh: '试听课', durationSeconds: 240 }] } };
  mocks.load.mockImplementation(async (resource: PlatformResource) => ({ items: resource === 'courses' ? [course] : [] }));
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(landingWithQueryState()));
    const action = host.querySelector('.platform-home-hero .platform-button-primary');
    expect(action?.textContent).toContain('免费试听第一课');
    expect(action?.getAttribute('href')).toBe('/platform/courses/trial-course/sections/core?lesson=trial-lesson');
  } finally { await act(async () => root.unmount()); }
});

it('shows the self-assessed path states for the matching account, without deriving speed from video progress', async () => {
  const key = 'cuberoot-platform-home-milestone:1';
  localStorage.setItem(key, '2');
  const host = document.createElement('div'), root = createRoot(host);
  document.body.append(host);
  try {
    await act(async () => root.render(landingWithQueryState()));
    expect(host.querySelector('.path-grid [aria-current="step"]')?.textContent).toContain('稳定 30 秒');
    expect(host.querySelector('.path-grid')?.getAttribute('data-layout')).toBe('expanded');
    expect(mocks.stage).toHaveBeenCalledWith(expect.anything(), 'sub30', true);
    await act(async () => host.querySelector<HTMLButtonElement>('.path-change')!.click());
    const buttons = host.querySelectorAll<HTMLButtonElement>('.path-stage');
    await act(async () => { buttons[4]!.click(); buttons[1]!.click(); });
    expect(localStorage.getItem(key)).toBe('4');
    expect(buttons[4]!.disabled).toBe(true);
    const first = host.querySelector('.path-details a');
    expect(document.activeElement).toBe(first);
    expect(first?.getAttribute('href')).toBe('/platform/courses?category=speed&q=15');
    expect(host.querySelector('.path-details')?.textContent).toContain('仅用于推荐，不影响课程访问');
    expect(host.querySelector('.platform-home-path [role="status"]')?.textContent).toContain('已定位到');
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'})); });
    expect(document.activeElement).toBe(buttons[4]);
    expect(host.querySelector('.path-grid [style]')).toBeNull();
    await act(async () => buttons[0]!.click());
    expect(localStorage.getItem(key)).toBe('0');
    await act(async () => host.querySelector<HTMLButtonElement>('.path-change')!.click());
    expect(document.activeElement).toBe(buttons[0]);
    mocks.user = { uid: 2, name: '另一学员' };
    await act(async () => root.render(landingWithQueryState()));
    expect(host.querySelector('.path-grid [aria-current="step"]')).toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); localStorage.removeItem(key); }
});

it.each(['trial', 'two-trials', 'finished', 'enrolled', 'unlocked', 'mixed', 'unknown'])('only shows the redemption hint for verified trial-only learning (%s)', async scenario => {
  const entity = (id: string, watchedTrial = true) => ({ id, title: id, status: 'published', data: { presentation: { trialLessonIds: ['trial'] }, lessons: [{ id: 'trial', accessScope: 'public', durationSeconds: 240 }, { id: 'core', accessScope: 'entitled', durationSeconds: 300 }, ...(!watchedTrial ? [{ id: 'public-core', lessonType: 'introduction', accessScope: 'public', durationSeconds: 200 }] : [])], lessonAccess: scenario === 'unknown' ? undefined : [{ id: 'trial' }, ...(scenario === 'unlocked' ? [{ id: 'core' }] : [])] } });
  const first = entity('course-1'), second = entity('course-2', scenario !== 'mixed');
  mocks.load.mockImplementation(async (resource: PlatformResource, options: { params: { id?: string } }) => {
    if (resource === 'account-progress') return { items: [{ id: 'trial', title: '试听课', data: { courseId: 'course-1', lessonId: 'trial', status: scenario === 'finished' ? 'completed' : 'in_progress', positionSeconds: scenario === 'finished' ? 240 : 30, progressBps: scenario === 'finished' ? 10000 : 1250 } }, ...(['two-trials', 'mixed'].includes(scenario) ? [{ id: 'other', title: '另一课时', data: { courseId: 'course-2', lessonId: scenario === 'mixed' ? 'public-core' : 'trial', status: 'completed' } }] : [])] };
    if (resource === 'account-courses') return { items: scenario === 'enrolled' ? [{ ...first, status: 'active', data: { ...first.data, courseStatus: 'published', progressBps: 1000 } }] : [] };
    return { items: options.params.id === 'course-2' ? [second] : [first] };
  });
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(landingWithQueryState()));
    expect(host.querySelector('.platform-home-resume')).not.toBeNull();
    const hint = host.querySelector('.platform-home-trial-note a');
    if (scenario === 'trial' || scenario === 'two-trials' || scenario === 'finished') {
      expect(hint?.textContent).toContain('试听结束后，可兑换码解锁完整课程');
      expect(hint?.getAttribute('href')).toBe('/platform/account/invites');
      if (scenario === 'finished') expect(host.querySelector('.platform-home-resume')?.getAttribute('href')).toBe('/platform/courses/course-1');
    } else expect(hint).toBeNull();
  } finally { await act(async () => root.unmount()); }
});

it.each([false, true])('replaces the current course in recommendations only if another published course exists (%s)', async hasOtherCourse => {
  const current = { id: 'current', title: '当前课程', status: 'published', data: { courseStatus: 'published', progressBps: 300, presentation: { trialLessonIds: [] } } };
  const alternative = { id: 'other', title: '其他课程', status: 'published', data: { presentation: { level: '基础学员', trialLessonIds: ['trial'] }, lessons: [{ id: 'intro', titleZh: '先导课', durationSeconds: 60 }, { id: 'trial', titleZh: '试听课', accessScope: 'public', durationSeconds: 120 }, { id: 'core', titleZh: '正式课', durationSeconds: 180 }] } };
  mocks.slides.mockResolvedValue([{ id: 'current', type: 'course', section: 'featured', titleZh: '当前课程', titleEn: 'Current course', coverUrl: null }]);
  mocks.load.mockImplementation(async (resource: PlatformResource, options: { params: { id?: string } }) => {
    if (resource === 'account-courses') return { items: [{ ...current, status: 'active' }] };
    if (resource === 'account-progress') return { items: [] };
    if (options.params.id) return { items: [options.params.id === 'other' ? alternative : current] };
    const items = hasOtherCourse ? [current, alternative] : [current];
    return { items, total: items.length };
  });
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(landingWithQueryState()));
    const carousel = host.querySelector('.platform-home-carousel');
    if (hasOtherCourse) {
      expect(carousel?.textContent).toContain('其他课程');
      expect(carousel?.textContent).toContain('1 节引言 + 2 节正式课');
      expect(carousel?.textContent).toContain('含 1 节免费试听');
      expect(carousel?.textContent).not.toContain('当前课程');
    } else expect(carousel).toBeNull();
  } finally { await act(async () => root.unmount()); }
});

it.each(['public', 'entitled'])('only resumes a non-enrolled trial lesson with public access (%s)', async accessScope => {
  const course = { id: 'trial-course', status: 'published', title: '试听课程', data: { lessons: [{ id: 'trial-lesson', accessScope, durationSeconds: 240 }] } };
  mocks.load.mockImplementation(async (resource: PlatformResource) => ({ items: resource === 'courses' ? [course] : resource === 'account-progress' ? [{ id: 'trial-lesson', title: '试听课时', data: { courseId: 'trial-course', lessonId: 'trial-lesson', positionSeconds: 60, progressBps: 2500, status: 'in_progress' } }] : [] }));
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(landingWithQueryState()));
    const resume = host.querySelector('.platform-home-resume');
    if (accessScope === 'public') {
      expect(resume?.getAttribute('href')).toBe('/platform/courses/trial-course/learn/trial-lesson');
      expect(resume?.textContent).toContain('本课剩余 3:00');
      expect(resume?.querySelector('progress')?.value).toBe(2500);
    } else expect(resume).toBeNull();
  } finally { await act(async () => root.unmount()); }
});

// Opt-in Chromium check: production React markup and production CSS, with no
// dependency on a live login, real payment data, API connectivity or Next dev.
it.runIf(process.env.PLATFORM_BROWSER_LAYOUT === '1')('fits guest, learner and empty home states at desktop, tablet and mobile widths', async () => {
  const css = ['../shared/src/timer/classic-appearance.css', '../app-ui/src/appearance.css', 'components/platform/platform.css', 'components/platform/learning-path.css'].map(path => readFileSync(path, 'utf8').replace(/^@import .*;$/gm, '')).join('\n');
  const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
  try {
    for (const state of ['guest', 'learner', 'empty']) {
      mocks.user = state === 'learner' ? { uid: 1, name: '测试学员' } : null;
      const lesson = { id: 'lesson1', titleZh: '试听课', accessScope: 'public', durationSeconds: 240 };
      const course = { id: 'course1', title: '三阶入门课程', status: 'published', data: { courseStatus: 'published', progressBps: 3500, presentation: { level: '零基础', highlights: ['学会独立复原'], trialLessonIds: ['lesson1'] }, lessons: [lesson] } };
      mocks.load.mockImplementation(async (resource: PlatformResource) => ({ items: state === 'empty' ? [] : resource === 'account-progress' ? [{ id: 'lesson1', title: '测试课时', data: { courseId: 'course1', lessonId: 'lesson1', status: 'in_progress', positionSeconds: 120 } }] : resource === 'account-courses' ? [{ ...course, status: 'active' }] : [course] }));
      mocks.slides.mockResolvedValue(state === 'empty' ? [] : [{ id: 'course1', type: 'course', section: 'featured', titleZh: '三阶入门课程', titleEn: 'Course', summaryZh: '学习独立复原的步骤', coverUrl: null }]);
      const host = document.createElement('div'), root = createRoot(host);
      try {
        await act(async () => root.render(landingWithQueryState()));
        expect(Boolean(host.querySelector('.platform-home-resume'))).toBe(state === 'learner');
        const page = await browser.newPage();
        try {
          await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}.clawd-deskpet,.deskpet-compact{position:fixed;right:12px;bottom:12px;width:90px;height:90px}${css}</style><div class="platform-shell platform-home-shell"><main class="platform-main">${host.innerHTML}</main></div><div class="clawd-deskpet"></div><div class="deskpet-compact"></div>`);
          for (const width of [1440, 1280, 768, 375]) {
            await page.setViewportSize({ width, height: 900 });
            for (const theme of ['light', 'dark']) {
              await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
              const result = await page.evaluate(() => {
                const main = document.querySelector('main')!.getBoundingClientRect();
                const links = [...document.querySelectorAll<HTMLElement>('.platform-landing a')];
                const context = document.createElement('canvas').getContext('2d')!;
                const luminance = (color: string) => {
                  context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
                  const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(channel => { const s = channel / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
                  return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722;
                };
                const text = [...document.querySelectorAll<HTMLElement>('.platform-home-hero p, .platform-home-learning-copy small, .platform-feature-copy p, .platform-button-primary, .path-stage')];
                const ratios = text.map(element => {
                  let background = getComputedStyle(element).backgroundColor, parent = element.parentElement;
                  while (background === 'rgba(0, 0, 0, 0)' && parent) { background = getComputedStyle(parent).backgroundColor; parent = parent.parentElement; }
                  const a = luminance(getComputedStyle(element).color), b = luminance(background);
                  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
                });
                const path = document.querySelector<HTMLElement>('.path-grid')!;
                const cards = [...path.querySelectorAll('button')].map(button => button.getBoundingClientRect());
                const columnCount = cards.filter(rect => Math.abs(rect.top - cards[0]!.top) < 1).length;
                return { overflow: document.documentElement.scrollWidth > innerWidth, offset: Math.abs(main.left - (innerWidth - main.right)), minFont: Math.min(...links.map(link => parseFloat(getComputedStyle(link).fontSize))), contrast: Math.min(...ratios), contained: links.every(link => { const rect = link.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth + 1; }), columnCount, minCardHeight: Math.min(...cards.map(rect => rect.height)), floatsHidden: [...document.querySelectorAll('.clawd-deskpet,.deskpet-compact')].every(element => getComputedStyle(element).display === 'none') };
              });
              expect(result, `${state}/${width}/${theme}`).toMatchObject({ overflow: false, contained: true, floatsHidden: true, columnCount: width < 700 ? 2 : 6 });
              expect(result.offset).toBeLessThanOrEqual(1);
              expect(result.minFont).toBeGreaterThanOrEqual(13);
              expect(result.minCardHeight).toBeGreaterThanOrEqual(44);
              expect(result.contrast).toBeGreaterThanOrEqual(4.5);
            }
          }
        } finally { await page.close(); }
      } finally { await act(async () => root.unmount()); }
    }
  } finally { await browser.close(); }
}, 30000);

it('uses a single primary catalog link and hides empty teacher and recommendation sections', async () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(landingWithQueryState()));
    expect(host.querySelector('.platform-instructors')).toBeNull();
    expect(host.querySelector('.platform-instructor-card')).toBeNull();
    expect(host.querySelector('.platform-home-resume')).toBeNull();
    expect(host.querySelector('.platform-home-hero .platform-button-primary')?.getAttribute('href')).toBe('/platform/courses');
    expect(host.querySelectorAll('.platform-button-primary')).toHaveLength(1);
    expect(host.querySelectorAll('.path-grid li')).toHaveLength(6);
    expect(host.querySelector('.platform-home-carousel')).toBeNull();
  } finally { await act(async () => root.unmount()); }
});

it('shows independent course progress, current lesson position and the authorized lesson poster', async () => {
  mocks.media.mockResolvedValue({ posterUrl: '/test-lesson-frame.webp' });
  mocks.load.mockImplementation(async (resource: PlatformResource) => {
    if (resource === 'account-courses') return { items: [{ id: 'course-1', title: '测试课程', data: { courseStatus: 'published', progressBps: 300, presentation: { coverUrl: '/test-course.webp' } } }] };
    if (resource === 'account-progress') return { items: [{ id: 'lesson-1', title: '测试课时', data: { courseId: 'course-1', lessonId: 'lesson-1', status: 'in_progress', positionSeconds: 224 } }] };
    if (resource === 'courses') return { items: [{ id: 'course-1', title: '测试课程', data: { lessons: [{ id: 'lesson-1', durationSeconds: 288 }] } }] };
    return { items: [] };
  });
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(landingWithQueryState()));
    const learning = host.querySelector('.platform-home-resume');
    expect(learning?.getAttribute('href')).toBe('/platform/courses/course-1/learn/lesson-1');
    expect(learning?.textContent).toContain('测试课程');
    expect(learning?.textContent).toContain('测试课时');
    expect(learning?.querySelector('progress')?.value).toBe(300);
    expect(learning?.querySelector('img')?.getAttribute('src')).toBe('/test-lesson-frame.webp');
    expect(learning?.querySelector('.platform-home-learning-play')).not.toBeNull();
    expect(learning?.textContent).toContain('课程进度 3%');
    expect(learning?.textContent).toContain('本课剩余 1:04');
    expect(learning?.textContent).toContain('从上次位置继续');
    expect(learning?.textContent).toContain('3:44');
    expect(host.querySelector('.platform-home-hero')).toBeNull();
    expect(host.querySelectorAll('.platform-button-primary')).toHaveLength(1);
  } finally { await act(async () => root.unmount()); }
});

it.each(['unlisted', 'archived', 'draft', undefined])('never recommends a course with visibility %s, even with recent progress', async courseStatus => {
  const hiddenCourse = { id: 'hidden', title: '不公开的课程', data: { courseStatus, progressBps: 5000 } };
  const hiddenProgress = { id: 'hidden-lesson', title: '不公开的课时', data: { courseId: 'hidden', status: 'in_progress' } };
  const publicCourse = { id: 'public', title: '公开课', data: { courseStatus: 'published' } };
  for (const includePublic of [true, false]) {
    mocks.load.mockImplementation(async (resource: PlatformResource) => {
      if (resource === 'account-courses') return { items: includePublic ? [hiddenCourse, publicCourse] : [hiddenCourse] };
      if (resource === 'account-progress') return { items: [hiddenProgress] };
      return { items: [] };
    });
    const host = document.createElement('div');
    const root = createRoot(host);
    try {
      await act(async () => root.render(landingWithQueryState()));
      const learning = host.querySelector('.platform-home-resume') ?? host.querySelector('.platform-home-hero .platform-button-primary');
      const href = includePublic ? '/platform/courses/public' : '/platform/courses';
      expect(learning?.getAttribute('href')).toBe(href);
      expect(host.querySelectorAll('.platform-button-primary')).toHaveLength(1);
      expect(learning?.textContent).not.toContain('不公开');
      expect(learning?.textContent).toContain(includePublic ? '公开课' : '浏览课程');
    } finally { await act(async () => root.unmount()); }
  }
});

it('verifies course visibility against the public catalog when the enrollment response is from an older backend', async () => {
  mocks.load.mockImplementation(async (resource: PlatformResource) => {
    if (resource === 'account-courses') return { items: [{ id: 'hidden', title: '不公开的课程' }, { id: 'public', title: '公开课' }] };
    if (resource === 'account-progress') return { items: [{ id: 'hidden-lesson', title: '不公开的课时', data: { courseId: 'hidden', status: 'in_progress' } }] };
    if (resource === 'courses') return { items: [{ id: 'public', title: '公开课' }], total: 1 };
    return { items: [] };
  });
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(landingWithQueryState()));
    const learning = host.querySelector('.platform-home-resume');
    expect(learning?.getAttribute('href')).toBe('/platform/courses/public');
    expect(learning?.textContent).toContain('公开课');
    expect(learning?.textContent).not.toContain('不公开');
  } finally { await act(async () => root.unmount()); }
});

it('displays the real teacher name, specialty and photo from the directory response', async () => {
  mocks.teachers.mockResolvedValue([{
    id: 42, kind: 'teacher', nameZh: '测试讲师', nameEn: 'Test Teacher',
    specialtiesZh: ['三阶'], specialtiesEn: ['3×3'], descriptionZh: '', descriptionEn: '',
    images: [{ kind: 'portrait', url: '/test-portrait.webp' }, { kind: 'teaching', url: '/test-teaching.webp' }],
  }]);
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(landingWithQueryState()));
    const card = host.querySelector('.platform-instructor-card');
    expect(card?.getAttribute('href')).toBe('/platform/teachers/42');
    expect(card?.textContent).toContain('测试讲师');
    expect(card?.textContent).toContain('三阶');
    expect(card?.querySelector('img')?.getAttribute('src')).toBe('/test-teaching.webp');
    expect(host.querySelectorAll('.platform-instructor-card')).toHaveLength(1);
  } finally { await act(async () => root.unmount()); }
});

it('rotates real mixed-content recommendations and removes navigation when only one remains', async () => {
  const course = { id: 'course1', type: 'course', section: 'featured', titleZh: '真实课程', titleEn: 'Course', summaryZh: '课程介绍', summaryEn: '', coverUrl: '/real.webp' };
  const school = { id: '42', type: 'organization', section: 'organization', titleZh: '公开机构', titleEn: 'School', summaryZh: '', summaryEn: '', coverUrl: null };
  mocks.slides.mockResolvedValue([course, school]);
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(landingWithQueryState()));
    const carousel = host.querySelector('.platform-home-carousel')!;
    expect(carousel.querySelector('h2')?.textContent).toBe(course.titleZh);
    expect(carousel.querySelector('a')?.getAttribute('href')).toBe('/platform/courses/course1');
    await act(async () => (carousel.querySelector('[aria-label="下一张"]') as HTMLButtonElement).click());
    expect(carousel.querySelector('h2')?.textContent).toBe(school.titleZh);
    expect(carousel.querySelector('a')?.getAttribute('href')).toBe('/platform/teachers/42');
    expect(carousel.querySelector('img')).toBeNull();
  } finally { await act(async () => root.unmount()); }
  mocks.slides.mockResolvedValue([course]);
  const singleHost = document.createElement('div'), singleRoot = createRoot(singleHost);
  try {
    await act(async () => singleRoot.render(landingWithQueryState()));
    expect(singleHost.querySelector('.platform-home-carousel h2')?.textContent).toBe(course.titleZh);
    expect(singleHost.querySelector('.platform-carousel-controls')).toBeNull();
    expect(singleHost.querySelector('.platform-carousel-arrows')).toBeNull();
  } finally { await act(async () => singleRoot.unmount()); }
});

it('lets administrators select a real public organization and save the ordered feature list', async () => {
  mocks.settings.mockResolvedValue({ settings: { featuredItems: [], sections: ['latest'] }, content: [{
    type: 'organization', id: '42', titleZh: '真实机构', titleEn: 'School', summaryZh: '', summaryEn: '', coverUrl: null,
  }] });
  const host = document.createElement('div'), root = createRoot(host);
  document.body.append(host);
  try {
    await act(async () => root.render(createElement(PlatformHomepageAdmin)));
    const [type, content] = host.querySelectorAll('select');
    const change = (select: HTMLSelectElement, value: string) => act(() => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
    change(type, 'organization');
    expect([...content.options].map(option => option.text)).toContain('真实机构');
    change(content, '42');
    const add = [...host.querySelectorAll('button')].find(button => button.textContent?.includes('添加推荐'))!;
    act(() => add.click());
    expect(host.querySelector('.platform-homepage-featured-row')?.textContent).toContain('真实机构');
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(mocks.saveSettings).toHaveBeenCalledWith({ featuredItems: [{ type: 'organization', id: '42', coverUrl: null, startsAt: null, endsAt: null }], sections: ['latest'] });
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it('restores the account stage on a fresh device and keeps a failed change retryable', async () => {
  const key = 'cuberoot-platform-home-milestone:1';
  localStorage.removeItem(key);
  mocks.stage.mockResolvedValueOnce('sub10').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('sub20');
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(landingWithQueryState()));
    expect(host.querySelector('.path-grid')?.getAttribute('data-layout')).toBe('expanded');
    expect(host.querySelector('.path-stage:disabled')?.textContent).toContain('稳定 10 秒');
    await act(async () => host.querySelector<HTMLButtonElement>('.path-change')!.click());
    await act(async () => host.querySelectorAll<HTMLButtonElement>('.path-stage')[3]!.click());
    expect(host.querySelector('.path-sync-feedback')?.textContent).toContain('尚未保存到账号');
    expect(localStorage.getItem(key)).toBe('5');
    await act(async () => host.querySelector<HTMLButtonElement>('.path-sync-feedback button')!.click());
    expect(localStorage.getItem(key)).toBe('3');
    expect(host.querySelector('.path-sync-feedback')).toBeNull();
  } finally { await act(async () => root.unmount()); localStorage.removeItem(key); }
});

it.each([360, 375, 390, 430].flatMap(width => [0, 2, 5].map(index => ({ width, index }))))('restores the mobile grid and handles rapid selections without animation at $width px (stage $index)', async ({ width, index }) => {
  const media = new EventTarget();
  vi.stubGlobal('matchMedia', (query: string) => Object.assign(media, { matches: query.includes('reduced-motion') || (query.includes('700px') && width < 700) }));
  const animate = vi.fn();
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate });
  mocks.stage.mockResolvedValueOnce('sub30').mockResolvedValue('sub10');
  const host = document.createElement('div'), root = createRoot(host);
  document.body.append(host);
  try {
    const urlUpdate = Promise.withResolvers<void>();
    const renderAt = (searchParams: string) => act(async () => root.render(landingWithQueryState(searchParams, () => urlUpdate.resolve())));
    await renderAt('?view=home');
    const grid = host.querySelector<HTMLElement>('.path-grid')!;
    expect(grid.dataset.layout).toBe('compact');
    expect(grid.querySelector('[aria-current="step"]')?.textContent).toContain('稳定 30 秒');
    const buttons = grid.querySelectorAll<HTMLButtonElement>('.path-stage');
    await act(async () => {
      buttons[index]!.click();
      buttons[(index + 1) % 6]!.click();
      await urlUpdate.promise;
    });
    expect(grid.dataset.layout).toBe('expanded');
    expect(buttons[index]!.disabled).toBe(true);
    const stage = learningStages[index]!;
    expect(Array.from(grid.querySelectorAll('a'), link => link.getAttribute('href'))).toEqual(
      [...stage.courses, ...stage.practice].map(entry => entry.href),
    );
    expect(document.activeElement).toBe(grid.querySelector('a'));
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    try {
      await act(async () => grid.querySelector<HTMLButtonElement>('.path-change')!.click());
      expect(back).toHaveBeenCalledOnce();
      await renderAt('');
      expect(grid.dataset.layout).toBe('compact');
      expect(document.activeElement).toBe(buttons[index]);
      expect(animate).not.toHaveBeenCalled();
    } finally { back.mockRestore(); }
  } finally {
    await act(async () => root.unmount());
    host.remove(); vi.unstubAllGlobals();
    if (descriptor) Object.defineProperty(Element.prototype, 'animate', descriptor);
    else Reflect.deleteProperty(Element.prototype, 'animate');
  }
});

it('shows the local timer suggestion and saves it only after a click', async () => {
  await import('@/lib/platform-timer-stage');
  const preference = 'cuberoot-platform-home-milestone:1';
  localStorage.removeItem(preference);
  const solves = Array.from({length: 5}, (_, i) => ({
    id: 'r' + i, event: '333', ts: i + 1, timeMs: 24500, penalty: 'ok', scramble: 'R U',
  }));
  localStorage.setItem('cuberoot-timer.v2', JSON.stringify({version: 2, byEvent: {'333': solves}}));
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(landingWithQueryState()));
    const recommended = host.querySelector<HTMLButtonElement>('[data-recommended] .path-stage');
    expect(recommended?.textContent).toContain('稳定 30 秒');
    expect(recommended?.textContent).toContain('计时推荐');
    expect(localStorage.getItem(preference)).toBeNull();
    expect(mocks.stage).toHaveBeenCalledTimes(1);
    await act(async () => recommended!.click());
    expect(mocks.stage).toHaveBeenLastCalledWith(expect.anything(), 'sub30');
    expect(host.querySelector('[data-recommended]')).toBeNull();
    expect(localStorage.getItem(preference)).toBe('2');
  } finally {
    await act(async () => root.unmount());
    localStorage.removeItem(preference);
    localStorage.removeItem('cuberoot-timer.v2');
  }
});
