// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/platform-gateway', () => ({ loadPlatformLessonMedia: load }));
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/components/AppLink', () => ({ default: () => null }));
vi.mock('@/components/platform/PlatformQrLanding', () => ({ PlatformQrLanding: () => null }));
import { PlatformDomainContent } from '@/components/platform/PlatformDomainContent';

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
