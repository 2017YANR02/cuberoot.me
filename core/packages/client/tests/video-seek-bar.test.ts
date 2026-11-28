// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { VideoSeekBar } from '@/components/video/VideoSeekBar';

it('seeks horizontally through vertical jitter and reveals thumbnails only after a deliberate pull', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  const root = createRoot(host);
  const onSeek = vi.fn();
  try {
    act(() => root.render(createElement(VideoSeekBar, {
      position: 0, total: 100, buffered: 0, step: 1, time: '0:00', onSeek,
      filmstrip: createElement('div', null, 'frames'),
    })));
    const rail = host.querySelector('input')!;
    rail.setPointerCapture = vi.fn();
    vi.spyOn(rail, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 100, 100, 16));
    const pointer = (type: string, x: number, y: number) => act(() => {
      rail.dispatchEvent(new PointerEvent(type, { pointerId: 1, isPrimary: true, bubbles: true, clientX: x, clientY: y }));
    });
    const strip = () => host.querySelector<HTMLElement>('.video-scrubber-reveal');
    pointer('pointerdown', 12, 100);
    for (const y of [97, 103, 94, 100, 80]) pointer('pointermove', 72, y);
    expect(onSeek).toHaveBeenLastCalledWith(72);
    expect(strip()).toBeNull();
    pointer('pointermove', 72, 64);
    expect(Number(strip()!.style.opacity)).toBeCloseTo(0.25);
    pointer('pointerup', 72, 16);
    expect(strip()!.style.opacity).toBe('1');
    pointer('pointerdown', 72, 16);
    pointer('pointermove', 85, 23);
    expect(strip()!.style.opacity).toBe('1');
    pointer('pointerup', 85, 110);
    expect(strip()!.style.opacity).toBe('0');
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
