// @vitest-environment jsdom
import { act, createElement, useState, type ComponentProps, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
vi.mock('@/hooks/useT', () => ({ useT: () => (zh: string) => zh }));
vi.mock('@/lib/platform-gateway', () => ({ loadPlatformLessonMedia: vi.fn(async () => ({ mimeType: 'video/mp4', accessUrl: '/test-video' })) }));
vi.mock('@/components/AppLink', () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => createElement('a', { href }, children) }));
vi.mock('@/components/platform/PlatformQrLanding', () => ({ PlatformQrLanding: () => null }));
import { LessonVideoPlayer } from '@/components/video/LessonVideoPlayer';
import { PlatformDomainContent } from '@/components/platform/PlatformDomainContent';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true; this.querySelector('button')?.focus(); } },
    close: { configurable: true, value() { this.open = false; } },
  });
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function mount(props: Partial<ComponentProps<typeof LessonVideoPlayer>> = {}) {
  await act(async () => root.render(createElement(LessonVideoPlayer, { src: '/test', onError: vi.fn(), onLoadedMetadata: vi.fn(), ...props })));
  const video = host.querySelector('video')!;
  Object.defineProperty(video, 'duration', { configurable: true, value: 100 });
  await act(async () => video.dispatchEvent(new Event('loadedmetadata')));
  return video;
}
async function key(key: string, options: KeyboardEventInit = {}, target: EventTarget = document.body) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  await act(async () => target.dispatchEvent(event));
  return event;
}

it('opens help from ? or settings, contains all four groups, blocks playback and restores focus', async () => {
  const video = await mount();
  const player = host.querySelector<HTMLElement>('.lesson-video-player')!;
  player.focus();
  await key('I', { shiftKey: true }, player);
  expect(host.querySelector('dialog')).toBeNull();
  await key('?', { shiftKey: true }, player);
  expect(host.querySelector('dialog')?.open).toBe(true);
  expect([...host.querySelectorAll('dialog h3')].map(el => el.textContent)).toEqual(['播放', '常规', '字幕', '全景视频']);
  expect(host.querySelector('dialog')?.textContent).toContain('? (Shift + /)');
  expect(host.querySelector('dialog')?.textContent).toContain('不可用');
  await key('l', {}, document.activeElement!);
  expect(video.currentTime).toBe(0);
  await key('Escape', {}, document.activeElement!);
  expect(host.querySelector('dialog')).toBeNull();
  expect(document.activeElement).toBe(player);
  await key('?', {}, player);
  expect(host.querySelector('dialog')?.open).toBe(true);
  await key('Escape', {}, document.activeElement!);
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="设置"]')!.click());
  await act(async () => [...host.querySelectorAll<HTMLButtonElement>('.lesson-video-menu button')].find(button => button.textContent?.includes('键盘快捷键'))!.click());
  expect(host.querySelector('dialog')?.open).toBe(true);
  await act(async () => host.querySelector<HTMLButtonElement>('dialog footer button')!.click());
  expect(host.querySelector('dialog')).toBeNull();
});

it('closes help on a backdrop click while keeping content and panel padding clicks open', async () => {
  await mount();
  const player = host.querySelector<HTMLElement>('.lesson-video-player')!;
  player.focus();
  await key('?', { shiftKey: true }, player);
  const dialog = host.querySelector('dialog')!;
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({ left: 100, right: 500, top: 100, bottom: 500 } as DOMRect);
  await act(async () => dialog.querySelector('h2')!.click());
  expect(dialog.open).toBe(true);
  await act(async () => dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 110, clientY: 110 })));
  expect(dialog.open).toBe(true);
  await act(async () => dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 50, clientY: 110 })));
  expect(host.querySelector('dialog')).toBeNull();
  expect(document.activeElement).toBe(player);
});

it('seeks from live media time, clamps bounds and keeps native slider navigation', async () => {
  const video = await mount();
  video.currentTime = 50;
  await key('j'); expect(video.currentTime).toBe(40);
  await key('l'); expect(video.currentTime).toBe(50);
  await key('ArrowLeft'); expect(video.currentTime).toBe(45);
  await key('ArrowRight'); expect(video.currentTime).toBe(50);
  for (let digit = 0; digit <= 9; digit++) { await key(String(digit)); expect(video.currentTime).toBe(digit * 10); }
  video.currentTime = 99; await key('l'); expect(video.currentTime).toBe(100);
  video.currentTime = 1; await key('j'); expect(video.currentTime).toBe(0);
  const slider = host.querySelector('input[type="range"]')!;
  expect((await key('ArrowRight', {}, slider)).defaultPrevented).toBe(false);
  expect(video.currentTime).toBe(0);
  Object.defineProperty(video, 'duration', { value: Infinity });
  await act(async () => video.dispatchEvent(new Event('durationchange')));
  await key('5'); expect(video.currentTime).toBe(0);
});

it('does not hijack typing, IME, modified browser shortcuts or unrelated buttons', async () => {
  const video = await mount();
  const input = document.createElement('input'); host.append(input);
  const editable = document.createElement('div'); editable.contentEditable = 'true'; editable.setAttribute('contenteditable', 'true'); host.append(editable);
  for (const target of [input, editable]) {
    await key('l', {}, target); await key('?', { shiftKey: true }, target);
  }
  const unrelated = document.createElement('button'); host.append(unrelated);
  await key('l', {}, unrelated);
  await key('l', { ctrlKey: true }); await key('l', { metaKey: true }); await key('l', { altKey: true }); await key('l', { isComposing: true });
  for (const options of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }]) await key('?', options);
  expect(video.currentTime).toBe(0); expect(host.querySelector('dialog')).toBeNull();
  const play = host.querySelector<HTMLButtonElement>('[aria-label="播放"]')!;
  expect((await key(' ', {}, play)).defaultPrevented).toBe(false);
  await key('l', {}, play); expect(video.currentTime).toBe(10);
});

it('steps only while paused and keeps speed and volume within supported limits', async () => {
  const video = await mount();
  video.currentTime = 1;
  await key('.'); expect(video.currentTime).toBe(1 + 1 / 30);
  await key(','); expect(video.currentTime).toBe(1);
  Object.defineProperty(video, 'paused', { configurable: true, value: false });
  await key('.'); expect(video.currentTime).toBe(1);
  await key('>', { shiftKey: true }); expect(video.playbackRate).toBe(1.25);
  for (let index = 0; index < 12; index++) await key('>', { shiftKey: true });
  expect(video.playbackRate).toBe(2);
  for (let index = 0; index < 12; index++) await key('<', { shiftKey: true });
  expect(video.playbackRate).toBe(.25);
  video.volume = .99; await key('ArrowUp'); expect(video.volume).toBe(1);
  video.volume = .01; await key('ArrowDown'); expect(video.volume).toBe(0);
  await key('m'); expect(video.muted).toBe(true);
  await key('m', { repeat: true }); expect(video.muted).toBe(true);
  await key('m'); expect(video.muted).toBe(false);
});

it('uses sampled frame timing and cancels sampling on unmount', async () => {
  let callback: VideoFrameRequestCallback | undefined;
  const request = vi.fn((next: VideoFrameRequestCallback) => { callback = next; return 42; });
  const cancel = vi.fn();
  Object.defineProperties(HTMLVideoElement.prototype, {
    requestVideoFrameCallback: { configurable: true, value: request },
    cancelVideoFrameCallback: { configurable: true, value: cancel },
  });
  try {
    const video = await mount();
    Object.defineProperty(video, 'paused', { configurable: true, value: false });
    callback!(0, { mediaTime: 0, presentedFrames: 1 } as VideoFrameCallbackMetadata);
    callback!(40, { mediaTime: .04, presentedFrames: 2 } as VideoFrameCallbackMetadata);
    Object.defineProperty(video, 'paused', { value: true });
    video.currentTime = 1; await key('.'); expect(video.currentTime).toBe(1.04);
    await act(async () => root.render(null)); expect(cancel).toHaveBeenCalledWith(42);
  } finally {
    Reflect.deleteProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback');
    Reflect.deleteProperty(HTMLVideoElement.prototype, 'cancelVideoFrameCallback');
  }
});

it('controls play, theater, fullscreen and miniplayer with the existing media APIs', async () => {
  const video = await mount();
  const play = vi.spyOn(video, 'play').mockResolvedValue(); const pause = vi.spyOn(video, 'pause').mockImplementation(() => {});
  await key('k'); expect(play).toHaveBeenCalledOnce();
  await key('k', { repeat: true }); expect(play).toHaveBeenCalledOnce();
  Object.defineProperty(video, 'paused', { value: false });
  await key('k'); expect(pause).toHaveBeenCalledOnce();
  await key('t'); expect(host.querySelector('.is-theater')).not.toBeNull();
  await key('t'); expect(host.querySelector('.is-theater')).toBeNull();
  const fullscreen = vi.fn().mockResolvedValue(undefined), pip = vi.fn().mockResolvedValue(undefined), exit = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(host.querySelector('.lesson-video-player'), 'requestFullscreen', { value: fullscreen });
  Object.defineProperty(video, 'requestPictureInPicture', { value: pip });
  Object.defineProperty(document, 'exitPictureInPicture', { configurable: true, value: exit });
  await key('f'); expect(fullscreen).toHaveBeenCalledOnce();
  await key('i'); expect(pip).toHaveBeenCalledOnce();
  Object.defineProperty(document, 'pictureInPictureElement', { configurable: true, value: video });
  await key('Escape'); expect(exit).toHaveBeenCalledOnce();
  Reflect.deleteProperty(document, 'pictureInPictureElement');
});

it('navigates adjacent lessons with Shift+N/P and stops at each end', async () => {
  function Classroom() {
    const [selectedLessonId, onSelectLesson] = useState<string | null>(null);
    return createElement(PlatformDomainContent, {
      definition: { id: 'course-section-core' } as PlatformRouteDefinition,
      entity: { id: 'course', title: 'Course', data: { lessons: [{ id: 'first', titleZh: '正式课 01' }, { id: 'last', titleZh: '正式课 02' }] } } as PlatformEntity,
      params: {}, selectedLessonId, onSelectLesson,
    });
  }
  await act(async () => root.render(createElement(Classroom)));
  const selected = () => host.querySelector('nav button[aria-current]');
  const first = selected();
  await key('P', { shiftKey: true }); expect(selected()).toBe(first);
  await key('N', { shiftKey: true }, first!); expect(selected()).not.toBe(first);
  expect(host.querySelector('video')!.autoplay).toBe(true);
  const last = selected();
  await key('N', { shiftKey: true }); expect(selected()).toBe(last);
  await key('P', { shiftKey: true }); expect(selected()).toBe(first);
});
