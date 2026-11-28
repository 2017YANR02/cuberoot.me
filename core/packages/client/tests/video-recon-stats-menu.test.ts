// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { TpsGraph } from '@/app/[lang]/video-recon/TpsGraph';
import { VideoStatsStage } from '@/app/[lang]/video-recon/VideoStatsStage';

it('reveals source details on request, keeps TPS seeking live and releases the overlay on close or source replacement', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const onSeek = vi.fn();
  const render = (fileName: string, cursor?: number) => act(async () => root.render(createElement(VideoStatsStage, {
    fileName, children: createElement('canvas'),
    stats: cursor === undefined ? undefined : createElement(TpsGraph, {
      complete: true, turns: [{ timestamp: 1, move: 'R' }], fps: 30, start: 0, end: 4.7, cursor, onSeek,
    }),
  })));
  const openMenu = () => act(async () => {
    host.querySelector('canvas')!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  });
  const choose = () => act(async () => host.querySelector<HTMLButtonElement>('[role="menuitemcheckbox"]')!.click());
  try {
    await render('solve.mp4');
    const canvas = host.querySelector('canvas');
    expect(host.textContent).toBe('');
    await openMenu();
    await choose();
    expect(host.querySelector('dd')?.textContent).toBe('solve.mp4');
    await render('solve.mp4', 1.2);
    const graph = host.querySelector('[role="slider"]')!;
    expect(graph.getAttribute('aria-valuenow')).toBe('1.2');
    graph.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'End' }));
    expect(onSeek).toHaveBeenCalledWith(4.7);
    await act(async () => host.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click());
    expect(host.textContent).toBe('');
    expect(host.querySelector('canvas')).toBe(canvas);
    await openMenu();
    await choose();
    await render('another.mp4');
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    await act(async () => root.render(null));
    await render('third.mp4');
    await openMenu();
    await choose();
    expect(host.querySelector('dd')?.textContent).toBe('third.mp4');
  } finally {
    act(() => root.unmount());
    host.remove(); vi.unstubAllGlobals();
  }
});

it('uses the course playback overlay with the reconstruction frame clock and reveals it after idle', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const playback = {
    playing: true, speed: 1 as const, position: .85, end: 4.7, index: 9, length: 52,
    onPlay: vi.fn(), onStep: vi.fn(), onSeekIndex: vi.fn(), onSpeed: vi.fn(),
  };
  try {
    await act(async () => root.render(createElement(VideoStatsStage, {
      playback, fileName: 'solve.mp4', children: createElement('canvas'),
    })));
    const stage = host.querySelector<HTMLElement>('[aria-haspopup="menu"]')!;
    const rangeSelection = () => act(async () => root.render(createElement(VideoStatsStage, {
      fileName: 'solve.mp4', settingsAvailable: false, settingsSlotRef: () => {}, children: createElement('canvas'),
    })));
    act(() => stage.querySelector<HTMLButtonElement>('.lesson-video-settings')!.click());
    expect(stage.querySelector('.video-recon-settings')).not.toBeNull();
    await rangeSelection();
    expect(stage.querySelector('.lesson-video-settings')).toBeNull();
    expect(stage.querySelector('.video-recon-settings')).toBeNull();
    await act(async () => root.render(createElement(VideoStatsStage, {
      playback, fileName: 'solve.mp4', settingsAvailable: true, children: createElement('canvas'),
    })));
    expect(stage.querySelector('.lesson-video-settings')?.getAttribute('aria-expanded')).toBe('false');
    const bar = stage.querySelector<HTMLElement>('.lesson-video-controls')!;
    const slider = bar.querySelector('input')!;
    expect([slider.value, slider.max, slider.step]).toEqual(['9', '51', '1']);
    expect(slider.getAttribute('aria-valuetext')).toBe('0:00.85 / 0:04.70');
    const buttons = bar.querySelectorAll('button');
    for (const button of buttons) act(() => button.click());
    const settings = stage.querySelector('.video-recon-settings')!;
    expect(settings).toBeTruthy();
    act(() => settings.querySelector('button')!.click());
    expect(stage.querySelector('.video-recon-settings')).toBeNull();
    expect(stage.querySelector('.video-recon-stats dd')?.textContent).toBe('solve.mp4');
    expect(playback.onPlay).toHaveBeenCalledOnce();
    expect(playback.onStep.mock.calls).toEqual([[-10], [-1], [1], [10]]);
    expect(playback.onSeekIndex).not.toHaveBeenCalled();
    const speed = bar.querySelector('select')!;
    act(() => {
      speed.value = '0.5';
      speed.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(playback.onSpeed).toHaveBeenCalledWith(.5);
    act(() => vi.advanceTimersByTime(2700));
    expect(bar.dataset.visible).toBe('false');
    act(() => stage.dispatchEvent(new Event('pointermove', { bubbles: true })));
    expect(bar.dataset.visible).toBe('true');
    await act(async () => root.render(createElement(VideoStatsStage, {
      playback: { ...playback, playing: false }, fileName: 'solve.mp4', children: createElement('canvas'),
    })));
    act(() => stage.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: bar })));
    act(() => vi.advanceTimersByTime(2700));
    expect(bar.dataset.visible).toBe('true');
    act(() => bar.dispatchEvent(new MouseEvent('pointerout', { bubbles: true, relatedTarget: stage })));
    expect(bar.dataset.visible).toBe('true');
    act(() => vi.advanceTimersByTime(2700));
    expect(bar.dataset.visible).toBe('false');
  } finally {
    act(() => root.unmount());
    host.remove(); vi.useRealTimers(); vi.unstubAllGlobals();
  }
});
