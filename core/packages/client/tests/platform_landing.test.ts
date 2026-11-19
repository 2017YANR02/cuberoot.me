// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it, vi } from 'vitest';
import type { PlatformResource } from '@/lib/platform-types';

const mocks = vi.hoisted(() => ({
  user: { uid: 1, name: '学员' },
  teachers: vi.fn(),
  load: vi.fn(),
  slides: vi.fn(),
  settings: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => mocks.user, useIsAdmin: () => false, getSessionToken: () => null }));
vi.mock('@/lib/teacher-directory-api', () => ({ fetchTeacherDirectory: mocks.teachers }));
vi.mock('@/lib/teaching-saas-api', () => ({ listTeachingLearningContexts: vi.fn(), listTeachingOrganizations: vi.fn() }));
vi.mock('@/lib/platform-gateway', () => ({ loadPlatformResource: mocks.load, PlatformPermissionError: class extends Error {} }));
vi.mock('@/lib/platform-homepage', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/platform-homepage')>(), loadHomepageSlides: mocks.slides, loadHomepageSettings: mocks.settings, saveHomepageSettings: mocks.saveSettings }));
vi.mock('@/components/AppLink', () => ({ default: ({ className, href, children }: { className?: string; href: string; children: ReactNode }) => createElement('a', { className, href }, children) }));
vi.mock('next/image', () => ({ default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => createElement('img', { src, alt, className }) }));

import { PlatformLanding } from '@/components/platform/PlatformLanding';
import { PlatformHomepageAdmin } from '@/components/platform/PlatformHomepageAdmin';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  mocks.teachers.mockReset().mockResolvedValue([]);
  mocks.load.mockReset().mockResolvedValue({ items: [] });
  mocks.slides.mockReset().mockResolvedValue([]);
  mocks.settings.mockReset().mockResolvedValue({ settings: { featuredItems: [], sections: [] }, content: [] });
  mocks.saveSettings.mockReset().mockImplementation(async settings => ({ settings }));
});

it('uses the course catalog link and a genuine empty teacher state when the backend returns no records', async () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(PlatformLanding)));
    expect(host.querySelector('.platform-instructors-empty')?.textContent).toContain('暂无公开讲师资料');
    expect(host.querySelector('.platform-instructor-card')).toBeNull();
    const learning = host.querySelector('.platform-home-resume');
    expect(learning?.getAttribute('href')).toBe('/platform/courses');
    expect(learning?.textContent).toContain('开始你的第一门课');
    expect(learning?.textContent).not.toContain('继续学习');
    expect(learning?.querySelector('progress')).toBeNull();
    expect(learning?.querySelector('img')).toBeNull();
    const discovery = host.querySelector('.platform-home-action-list');
    expect(discovery?.querySelectorAll('.platform-home-tile-icon')).toHaveLength(4);
    expect(discovery?.querySelector('img')).toBeNull();
  } finally { await act(async () => root.unmount()); }
});

it('shows the actual course title, lesson, cover and progress supplied by the backend', async () => {
  mocks.load.mockImplementation(async (resource: PlatformResource) => {
    if (resource === 'account-courses') return { items: [{ id: 'course-1', title: '测试课程', data: { progressBps: 3500, presentation: { coverUrl: '/test-course.webp' } } }] };
    if (resource === 'account-progress') return { items: [{ id: 'lesson-1', title: '测试课时', data: { courseId: 'course-1', lessonId: 'lesson-1', status: 'in_progress' } }] };
    return { items: [] };
  });
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(PlatformLanding)));
    const learning = host.querySelector('.platform-home-resume');
    expect(learning?.getAttribute('href')).toBe('/platform/courses/course-1/learn/lesson-1');
    expect(learning?.textContent).toContain('测试课程');
    expect(learning?.textContent).toContain('测试课时');
    expect(learning?.querySelector('progress')?.value).toBe(3500);
    expect(learning?.querySelector('img')?.getAttribute('src')).toBe('/test-course.webp');
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
    await act(async () => root.render(createElement(PlatformLanding)));
    const card = host.querySelector('.platform-instructor-card');
    expect(card?.getAttribute('href')).toBe('/teachers?teacher=42');
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
    await act(async () => root.render(createElement(PlatformLanding)));
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
    await act(async () => singleRoot.render(createElement(PlatformLanding)));
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
