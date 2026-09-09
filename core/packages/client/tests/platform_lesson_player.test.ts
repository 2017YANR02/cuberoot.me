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
import { LessonVideoPlayer } from '@/components/video/LessonVideoPlayer';

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  load.mockReset().mockResolvedValue({ mimeType: 'video/mp4', accessUrl: '/signed-video', expiresAt: '2099-01-01T00:00:00Z' });
});

it('opens the video menu, prioritizes looping, and copies safe lesson links and diagnostics', async () => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  const host = document.createElement('div'), root = createRoot(host);
  document.body.append(host);
  const next = vi.fn();
  try {
    await act(async () => root.render(createElement(LessonVideoPlayer, {
      src: '/private-video?token=secret', lessonId: 'lesson-2', mediaId: 'media-2', mimeType: 'video/mp4',
      onError: vi.fn(), onLoadedMetadata: vi.fn(), autoContinue: true, onNext: next,
    })));
    const video = host.querySelector('video')!;
    const open = () => act(async () => { host.querySelector('.lesson-video-surface')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 80 })); });
    const item = (name: string) => [...host.querySelectorAll<HTMLButtonElement>('[role="menu"] button')].find(button => button.textContent === name)!;
    await open();
    expect(host.querySelectorAll('[role="menu"] button')).toHaveLength(8);
    expect(document.activeElement?.textContent).toBe('循环播放');
    await act(async () => item('循环播放').click());
    expect(video.loop).toBe(true);
    await act(async () => video.dispatchEvent(new Event('ended')));
    expect(next).not.toHaveBeenCalled();
    await open();
    expect(item('循环播放').getAttribute('aria-checked')).toBe('true');
    await act(async () => item('循环播放').click());
    await act(async () => video.dispatchEvent(new Event('ended')));
    expect(next).toHaveBeenCalledOnce();
    video.currentTime = 42.8;
    await open();
    await act(async () => item('复制当前时间的视频网址').click());
    const timed = new URL(writeText.mock.calls.at(-1)![0]);
    expect(timed.searchParams.get('lesson')).toBe('lesson-2');
    expect(timed.searchParams.get('t')).toBe('42');
    expect(timed.href).not.toContain('secret');
    expect(host.textContent).toContain('已复制');
    await open();
    await act(async () => item('复制视频网址').click());
    expect(new URL(writeText.mock.calls.at(-1)![0]).searchParams.has('t')).toBe(false);
    await open();
    await act(async () => item('复制嵌入代码').click());
    expect(writeText.mock.calls.at(-1)![0]).toContain('<iframe src=');
    expect(writeText.mock.calls.at(-1)![0]).not.toContain('private-video');
    await open();
    await act(async () => item('复制调试信息').click());
    const debug = JSON.parse(writeText.mock.calls.at(-1)![0]);
    expect(debug.mediaId).toBe('media-2');
    expect(debug.currentTime).toBe(42.8);
    expect(JSON.stringify(debug)).not.toContain('secret');
    writeText.mockRejectedValueOnce(new Error('denied'));
    await open();
    await act(async () => item('复制视频网址').click());
    expect(host.textContent).toContain('复制失败');
    await open();
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(host.querySelector('[role="menu"]')).toBeNull();
    await open();
    await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(host.querySelector('[role="menu"]')).toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});

it('updates real frame and contiguous-buffer statistics and stops sampling when closed', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(createElement(LessonVideoPlayer, { src: '/test', onError: vi.fn(), onLoadedMetadata: vi.fn() })));
    const video = host.querySelector('video')!;
    const frames = vi.fn(() => ({ totalVideoFrames: 403, droppedVideoFrames: 5 }));
    Object.defineProperties(video, {
      getVideoPlaybackQuality: { value: frames, configurable: true },
      buffered: { value: { length: 2, start: (index: number) => [0, 80][index], end: (index: number) => [30, 100][index] }, configurable: true },
      videoWidth: { value: 1280 }, videoHeight: { value: 720 },
    });
    video.currentTime = 20;
    const open = () => act(async () => { host.querySelector('.lesson-video-surface')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); });
    await open();
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('[role="menu"] button')].find(button => button.textContent === '详细统计信息')!.click());
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('丢失 5 / 共 403 帧');
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('1280×720');
    expect(host.querySelector('meter')?.value).toBe(10);
    video.currentTime = 50;
    await act(async () => vi.advanceTimersByTime(1000));
    expect(host.querySelector('meter')?.value).toBe(0);
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="关闭统计与诊断"]')!.click());
    const samples = frames.mock.calls.length;
    await act(async () => vi.advanceTimersByTime(5000));
    expect(frames).toHaveBeenCalledTimes(samples);
    await open();
    video.muted = true;
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('[role="menu"] button')].find(button => button.textContent === '排查播放问题')!.click());
    expect(host.querySelector('[role="dialog"]')?.textContent).toContain('当前播放器已静音');
  } finally { await act(async () => root.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); }
});

it('keeps the long-press menu open when touch release clicks the newly covered menu item', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(createElement(LessonVideoPlayer, { src: '/test', onError: vi.fn(), onLoadedMetadata: vi.fn() })));
    const down = new MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 60 });
    Object.defineProperty(down, 'pointerType', { value: 'touch' });
    await act(async () => host.querySelector('.lesson-video-surface')!.dispatchEvent(down));
    await act(async () => vi.advanceTimersByTime(550));
    const loopButton = host.querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]')!;
    expect(loopButton).not.toBeNull();
    await act(async () => loopButton.click());
    expect(host.querySelector('[role="menu"]')).not.toBeNull();
    expect(host.querySelector('video')!.loop).toBe(false);
    await act(async () => loopButton.click());
    expect(host.querySelector('video')!.loop).toBe(true);
  } finally { await act(async () => root.unmount()); vi.useRealTimers(); vi.unstubAllGlobals(); }
});

it.each([[42, 42], [999, 120], [-1, 0], [NaN, 0], [Infinity, 0]])('seeks shared timestamp %s within video bounds', async (startTime, expected) => {
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(createElement(LessonVideoPlayer, { src: '/test', startTime, onError: vi.fn(), onLoadedMetadata: vi.fn() })));
    const video = host.querySelector('video')!;
    Object.defineProperty(video, 'duration', { value: 120, configurable: true });
    await act(async () => video.dispatchEvent(new Event('loadedmetadata')));
    expect(video.currentTime).toBe(expected);
  } finally { await act(async () => root.unmount()); }
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
        Array.from({ length: [2, 2, 19][index] }, (_, lessonIndex) => String(lessonIndex + 1)));
      expect(host.querySelector('.platform-classroom-stage h2')?.textContent).toBe('1');
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

it.each([
  ['introduction', '先导课 01：课程介绍', undefined, false, '01：课程介绍'],
  ['introduction', '引言 02：讲师介绍', 'Introduction 02: Instructor', true, '02: Instructor'],
  ['trial', '试听课 01：做小花', 'Trial lessons 01: Daisy', true, '01: Daisy'],
  ['trial', '试听课 01：做小花', 'Trial 01: Daisy', true, '01: Daisy'],
  ['core', '正式课 01：还原十字', 'Core lesson 01: Cross', true, '01: Cross'],
  ['core', '正式课 01：还原十字', 'Core lessons 01: Cross', true, '01: Cross'],
  ['core', '正式课 01：还原十字', '', true, '01：还原十字'],
  ['core', '正式课 01：还原十字', 'Cross fundamentals', true, 'Cross fundamentals'],
  ['core', '正式课的学习方法', undefined, false, '正式课的学习方法'],
] as const)('removes only redundant numbered section prefixes: %s %s %s', async (section, titleZh, titleEn, english, expected) => {
  const host = document.createElement('div'), root = createRoot(host);
  const lesson = { id: 'lesson', titleZh, titleEn };
  locale.english = english;
  try {
    await act(async () => root.render(createElement(PlatformDomainContent, {
      definition: { id: `course-section-${section}` } as PlatformRouteDefinition,
      entity: { id: 'course', title: 'Course', data: { lessons: [lesson] } } as PlatformEntity, params: {},
    })));
    expect(host.querySelector('nav button')?.textContent).toBe(expected);
    expect(host.querySelector('.platform-classroom-stage h2')?.textContent).toBe(expected);
    expect(lesson).toEqual({ id: 'lesson', titleZh, titleEn });
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
    expect(host.querySelector('[aria-current]')?.textContent).toBe('02');
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
    expect(first.controls).toBe(false); expect(first.playsInline).toBe(true);
    expect(host.querySelector('button[aria-label="播放"]')).not.toBeNull();
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

it('connects playback, seeking, mute and speed controls to the media element', async () => {
  const host = document.createElement('div'), root = createRoot(host);
  document.body.append(host);
  try {
    await act(async () => root.render(createElement(LessonVideoPlayer, { src: '/test', onError: vi.fn(), onLoadedMetadata: vi.fn() })));
    const video = host.querySelector('video')!;
    const play = vi.spyOn(video, 'play').mockImplementation(async () => { video.dispatchEvent(new Event('play')); });
    Object.defineProperty(video, 'duration', { value: 120, configurable: true });
    await act(async () => video.dispatchEvent(new Event('loadedmetadata')));
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="播放"]')!.click());
    expect(play).toHaveBeenCalledOnce();
    expect(host.querySelector('button[aria-label="暂停"]')).not.toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="静音"]')!.click());
    expect(video.muted).toBe(true);
    const player = host.querySelector('.lesson-video-player')!;
    video.currentTime = 118;
    await act(async () => video.dispatchEvent(new Event('timeupdate')));
    await act(async () => player.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(video.currentTime).toBe(120);
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="设置"]')!.click());
    const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(element => element.textContent?.includes(text))!;
    await act(async () => button('播放速度').click());
    await act(async () => button('1.5×').click());
    expect(video.playbackRate).toBe(1.5);
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); }
});

it('pauses when the sleep timer expires and cancels a timer when disabled', async () => {
  vi.useFakeTimers();
  const host = document.createElement('div'), root = createRoot(host);
  try {
    await act(async () => root.render(createElement(LessonVideoPlayer, { src: '/test', onError: vi.fn(), onLoadedMetadata: vi.fn() })));
    const pause = vi.spyOn(host.querySelector('video')!, 'pause').mockImplementation(() => {});
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="设置"]')!.click());
    const button = (text: string) => [...host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(element => element.textContent?.includes(text))!;
    await act(async () => button('休眠定时器').click());
    await act(async () => button('10 分钟').click());
    await act(async () => vi.advanceTimersByTime(599_999));
    expect(pause).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(pause).toHaveBeenCalledOnce();
    await act(async () => button('休眠定时器').click());
    await act(async () => button('10 分钟').click());
    await act(async () => button('休眠定时器').click());
    await act(async () => button('关闭').click());
    await act(async () => vi.advanceTimersByTime(600_000));
    expect(pause).toHaveBeenCalledOnce();
  } finally { await act(async () => root.unmount()); vi.useRealTimers(); }
});

it('autoplays the next lesson only when enabled and stops at the last lesson', async () => {
  const host = document.createElement('div'), root = createRoot(host);
  function Classroom() {
    const [selectedLessonId, onSelectLesson] = useState<string | null>(null);
    return createElement(PlatformDomainContent, {
      definition: { id: 'course-section-core' } as PlatformRouteDefinition,
      entity: { id: 'course', title: 'Course', data: { lessons: [{ id: 'first', titleZh: '正式课 01' }, { id: 'last', titleZh: '正式课 02' }] } } as PlatformEntity,
      params: {}, selectedLessonId, onSelectLesson,
    });
  }
  try {
    await act(async () => root.render(createElement(Classroom)));
    await act(async () => host.querySelector('video')!.dispatchEvent(new Event('ended')));
    expect(host.querySelector('[aria-current]')?.textContent).toBe('01');
    await act(async () => host.querySelector<HTMLButtonElement>('[role="switch"][aria-label="自动播放下一课"]')!.click());
    await act(async () => host.querySelector('video')!.dispatchEvent(new Event('ended')));
    expect(host.querySelector('[aria-current]')?.textContent).toBe('02');
    expect(host.querySelector('video')!.autoplay).toBe(true);
    await act(async () => host.querySelector('video')!.dispatchEvent(new Event('ended')));
    expect(load).toHaveBeenCalledTimes(2);
    await act(async () => host.querySelector<HTMLButtonElement>('nav button')!.click());
    expect(host.querySelector('video')!.autoplay).toBe(false);
  } finally { await act(async () => root.unmount()); }
});
