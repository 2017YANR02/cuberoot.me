// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it, vi } from 'vitest';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/platform-gateway', () => ({ loadPlatformLessonMedia: load }));
const locale = vi.hoisted(() => ({ english: false }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string, en: string) => locale.english ? en : zh }));
vi.mock('@/components/AppLink', () => ({ default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => createElement('a', { href, className }, children) }));
vi.mock('@/components/platform/PlatformQrLanding', () => ({ PlatformQrLanding: () => null }));
import { PlatformDomainContent } from '@/components/platform/PlatformDomainContent';

beforeEach(() => {
  load.mockReset().mockResolvedValue({ mimeType: 'video/mp4', accessUrl: '/signed-video', expiresAt: '2099-01-01T00:00:00Z' });
});

it('links section cards to separate lesson pages without losing lessons or changing other courses', async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const lessons = ['先导课', '试听课', '正式课'].flatMap((prefix, group) =>
    Array.from({ length: [2, 2, 19][group] }, (_, index) => ({
      id: `${group}-${index}`, titleZh: `${prefix} ${index + 1}`, titleEn: `Lesson ${group}-${index}`, status: 'published',
    })));
  const host = document.createElement('div'), root = createRoot(host);
  const render = (items: unknown[], id = 'course-detail') => act(async () => root.render(createElement(PlatformDomainContent, {
    definition: { id } as PlatformRouteDefinition,
    entity: { id: 'course', title: 'Course', data: { lessons: items } } as PlatformEntity, params: {},
  })));
  try {
    await render(lessons);
    expect(host.querySelector('.platform-lesson-grid')).not.toBeNull();
    expect(host.querySelectorAll('.platform-lesson-cover')).toHaveLength(3);
    expect([...host.querySelectorAll('.platform-lesson-card-title')].map(node => node.textContent)).toEqual(['引言', '试听课', '正式课']);
    expect(host.querySelector('details')).toBeNull();
    expect([...host.querySelectorAll('a')].map(node => node.getAttribute('href'))).toEqual(
      ['introduction', 'trial', 'core'].map(section => `/platform/courses/course/sections/${section}`));
    for (const [index, section] of ['introduction', 'trial', 'core'].entries()) {
      await render(lessons, `course-section-${section}`);
      expect(host.textContent).not.toContain('published');
      expect([...host.querySelectorAll('nav button')].map(node => node.textContent)).toEqual(
        lessons.filter(lesson => lesson.id.startsWith(`${index}-`)).map(lesson => lesson.titleZh.replace(/^先导课/, '引言')));
      expect(host.querySelector('.platform-classroom-stage h2')?.textContent).toBe(lessons.find(lesson => lesson.id.startsWith(`${index}-`))!.titleZh.replace(/^先导课/, '引言'));
      expect(host.querySelectorAll('video')).toHaveLength(1);
      expect(host.querySelector('a')).toBeNull();
    }
    locale.english = true;
    await render(lessons);
    expect([...host.querySelectorAll('.platform-lesson-card-title')].map(node => node.textContent)).toEqual(['Introduction', 'Trial lessons', 'Core lessons']);
    await render(lessons, 'course-section-introduction');
    expect(host.querySelector('nav button')?.textContent).toBe('Lesson 0-0');
    await render([...lessons, { id: 'extra', titleZh: '附加内容' }]);
    expect(host.querySelector('details')).toBeNull();
    expect(host.querySelectorAll('a')).toHaveLength(24);
    await render([lessons[0]]);
    expect(host.querySelectorAll('.platform-lesson-card')).toHaveLength(1);
    await render([]);
    expect(host.querySelector('details')).toBeNull();
    expect(host.querySelector('a')).toBeNull();
  } finally { locale.english = false; await act(async () => root.unmount()); }
});

it('switches videos in place, resets position, rejects stale IDs and ignores aborted media requests', async () => {
  const host = document.createElement('div'), root = createRoot(host);
  let resolveOld!: (value: unknown) => void;
  load.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  const props = {
    definition: { id: 'course-section-core' } as PlatformRouteDefinition,
    entity: { id: 'course', title: 'Course', data: { lessons: [
      { id: 'first', titleZh: '正式课 01' }, { id: 'second', titleZh: '正式课 02' },
      { id: 'other', titleZh: '试听课 01' }, { titleZh: '正式课 无效' },
    ] } } as PlatformEntity, params: {},
  };
  function Classroom() {
    const [selectedLessonId, onSelectLesson] = useState('invalid');
    return createElement(PlatformDomainContent, { ...props, selectedLessonId, onSelectLesson });
  }
  try {
    await act(async () => root.render(createElement(Classroom)));
    expect(load.mock.calls[0][0]).toBe('first');
    expect(host.querySelectorAll('nav button')).toHaveLength(2);
    await act(async () => (host.querySelectorAll('nav button')[1] as HTMLButtonElement).click());
    expect(load.mock.calls[0][1].aborted).toBe(true);
    expect(host.querySelector('[aria-current]')?.textContent).toBe('正式课 02');
    expect(host.querySelector('video')?.getAttribute('src')).toBe('/signed-video');
    await act(async () => resolveOld({ mimeType: 'video/mp4', accessUrl: '/stale' }));
    expect(host.querySelector('video')?.getAttribute('src')).toBe('/signed-video');
    host.querySelector('video')!.currentTime = 40;
    await act(async () => (host.querySelector('nav button') as HTMLButtonElement).click());
    expect(host.querySelector('video')!.currentTime).toBe(0);
    expect(host.querySelectorAll('video')).toHaveLength(1);
    load.mockRejectedValueOnce(new Error('Access denied'));
    await act(async () => (host.querySelectorAll('nav button')[1] as HTMLButtonElement).click());
    expect(host.querySelector('video')).toBeNull();
    expect(host.textContent).toContain('Access denied');
    await act(async () => root.render(createElement(PlatformDomainContent, { ...props, entity: { id: 'empty', data: { lessons: [] } } as unknown as PlatformEntity })));
    expect(host.querySelector('video')).toBeNull();
    expect(host.textContent).toContain('暂无课时');
  } finally { await act(async () => root.unmount()); }
});

it('shows instructor display names and only links an actual teacher directory entry', async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(createElement(PlatformDomainContent, {
      definition: { id: 'course-detail' } as PlatformRouteDefinition,
      entity: { id: 'course', title: 'Course', data: { instructors: [
        { id: 'internal-instructor-id', displayName: '颜瑞民', teacherEntryId: 'public-teacher' },
        { id: 'another-internal-id', displayName: '另一位讲师' },
      ] } } as PlatformEntity, params: {},
    })));
    expect(host.textContent).toContain('颜瑞民');
    expect(host.textContent).not.toContain('internal-id');
    expect(host.textContent).not.toContain('internal-instructor-id');
    expect(host.querySelectorAll('a')).toHaveLength(1);
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/platform/teachers/public-teacher');
  } finally { await act(async () => root.unmount()); }
});

it('renews expired playback access, keeps position, and does not loop on codec errors', async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const media = { mediaId: 'media', mimeType: 'video/mp4', sizeBytes: 100, accessUrl: '/signed-old', expiresAt: '2000-01-01T00:00:00Z' };
  load.mockResolvedValueOnce(media).mockResolvedValue({ ...media, accessUrl: '/signed-new', expiresAt: '2099-01-01T00:00:00Z' });
  const host = document.createElement('div'), root = createRoot(host);
  const props = (id: string) => ({ definition: { id: 'course-lesson' } as PlatformRouteDefinition,
    entity: { id, title: 'Lesson', data: { mediaId: 'media' } } as PlatformEntity, params: {} });
  try {
    await act(async () => root.render(createElement(PlatformDomainContent, props('lesson-1'))));
    const first = host.querySelector('video')!;
    expect(first.controls).toBe(true); expect(first.playsInline).toBe(true);
    first.currentTime = 123;
    await act(async () => first.dispatchEvent(new Event('error')));
    expect(load).toHaveBeenCalledTimes(2);
    const renewed = host.querySelector('video')!;
    expect(renewed.getAttribute('src')).toBe('/signed-new');
    await act(async () => renewed.dispatchEvent(new Event('loadedmetadata')));
    expect(renewed.currentTime).toBe(123);
    await act(async () => renewed.dispatchEvent(new Event('error')));
    expect(load).toHaveBeenCalledTimes(2);
    expect(host.querySelector('button')?.textContent).toBe('重新加载播放器');
    await act(async () => host.querySelector('button')!.click());
    expect(load).toHaveBeenCalledTimes(3);
    await act(async () => root.render(createElement(PlatformDomainContent, props('lesson-2'))));
    const next = host.querySelector('video')!;
    await act(async () => next.dispatchEvent(new Event('loadedmetadata')));
    expect(next.currentTime).toBe(0);
  } finally { await act(async () => root.unmount()); }
});
