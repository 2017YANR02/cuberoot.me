// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/platform-gateway', () => ({ loadPlatformLessonMedia: load }));
const locale = vi.hoisted(() => ({ english: false }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string, en: string) => locale.english ? en : zh }));
vi.mock('@/components/AppLink', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => createElement('a', { href }, children) }));
vi.mock('@/components/platform/PlatformQrLanding', () => ({ PlatformQrLanding: () => null }));
import { PlatformDomainContent } from '@/components/platform/PlatformDomainContent';

it('groups numbered lessons into three native folders without losing links or changing other courses', async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const lessons = ['先导课', '试听课', '正式课'].flatMap((prefix, group) =>
    Array.from({ length: [2, 2, 19][group] }, (_, index) => ({
      id: `${group}-${index}`, titleZh: `${prefix} ${index + 1}`, titleEn: `Lesson ${group}-${index}`,
    })));
  const host = document.createElement('div'), root = createRoot(host);
  const render = (items: unknown[]) => act(async () => root.render(createElement(PlatformDomainContent, {
    definition: { id: 'course-detail' } as PlatformRouteDefinition,
    entity: { id: 'course', title: 'Course', data: { lessons: items } } as PlatformEntity, params: {},
  })));
  try {
    await render(lessons);
    expect([...host.querySelectorAll('summary')].map(node => node.textContent)).toEqual(['先导课', '试听课', '正式课']);
    expect([...host.querySelectorAll('details')].map(node => node.querySelectorAll('a').length)).toEqual([2, 2, 19]);
    expect([...host.querySelectorAll('a')].map(node => node.getAttribute('href'))).toEqual(
      lessons.map(lesson => `/platform/courses/course/learn/${lesson.id}`));
    const folder = host.querySelector('details')!;
    expect(folder.open).toBe(false);
    await act(async () => folder.querySelector('summary')!.click());
    expect(folder.open).toBe(true);
    locale.english = true;
    await render(lessons);
    expect([...host.querySelectorAll('summary')].map(node => node.textContent)).toEqual(['Introduction', 'Trial lessons', 'Core lessons']);
    expect(host.querySelector('a')?.textContent).toBe('Lesson 0-0');
    await render([...lessons, { id: 'extra', titleZh: '附加内容' }]);
    expect(host.querySelector('details')).toBeNull();
    expect(host.querySelectorAll('a')).toHaveLength(24);
    await render([lessons[0]]);
    expect(host.querySelectorAll('details')).toHaveLength(1);
    await render([]);
    expect(host.querySelector('details')).toBeNull();
    expect(host.querySelector('a')).toBeNull();
  } finally { locale.english = false; await act(async () => root.unmount()); }
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
