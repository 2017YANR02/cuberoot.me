// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it, vi } from 'vitest';
import type { PlatformResource } from '@/lib/platform-types';

const mocks = vi.hoisted(() => ({
  user: { uid: 1, name: '学员' },
  teachers: vi.fn(),
  load: vi.fn(),
}));

vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/lib/auth-store', () => ({ useAuthUser: () => mocks.user, useIsAdmin: () => false, getSessionToken: () => null }));
vi.mock('@/lib/teacher-directory-api', () => ({ fetchTeacherDirectory: mocks.teachers }));
vi.mock('@/lib/teaching-saas-api', () => ({ listTeachingLearningContexts: vi.fn(), listTeachingOrganizations: vi.fn() }));
vi.mock('@/lib/platform-gateway', () => ({ loadPlatformResource: mocks.load, PlatformPermissionError: class extends Error {} }));
vi.mock('@/components/AppLink', () => ({ default: ({ className, href, children }: { className?: string; href: string; children: ReactNode }) => createElement('a', { className, href }, children) }));
vi.mock('next/image', () => ({ default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => createElement('img', { src, alt, className }) }));

import { PlatformLanding } from '@/components/platform/PlatformLanding';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  mocks.teachers.mockReset().mockResolvedValue([]);
  mocks.load.mockReset().mockResolvedValue({ items: [] });
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
