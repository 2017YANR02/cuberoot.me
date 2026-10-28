// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHangRenderer, HANG_HOOK_Y, nearTopHang } from '@/lib/deskpet-hang';

afterEach(() => vi.useRealTimers());

describe('top hanging', () => {
  it('uses the delivered hook coordinate and scales its release zone with the pet', () => {
    for (const height of [120, 176, 260]) {
      const edge = Math.max(24, height * .18) - height * HANG_HOOK_Y;
      expect(nearTopHang(edge, height)).toBe(true);
      expect(nearTopHang(edge + 1, height)).toBe(false);
      expect(nearTopHang(edge + 80, height, 80)).toBe(true);
    }
  });
  it('reverses the delivered rig in place and cancels superseded release completion', () => {
    vi.useFakeTimers();
    const object = document.createElement('object');
    const text = readFileSync(path.join(process.cwd(), 'public/deskpet/rootbeast-motion/rootbeast-hang-rig.svg'), 'utf8');
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    Object.defineProperty(object, 'contentDocument', { value: doc });
    const onRest = vi.fn(), onPhase = vi.fn();
    const renderer = createHangRenderer({ object, reducedMotion: () => false,
      onShow: vi.fn(), onRest, onPhase, onUnavailable: vi.fn() });
    expect(renderer.enter()).toBe(true);
    vi.advanceTimersByTime(120);
    renderer.release();
    expect(doc.documentElement.getAttribute('data-hang')).toBe('off');
    vi.advanceTimersByTime(100);
    renderer.enter();
    vi.advanceTimersByTime(500);
    expect(onRest).not.toHaveBeenCalled();
    expect(doc.documentElement.getAttribute('data-hang')).toBe('on');
    expect(object.contentDocument).toBe(doc);
    renderer.release();
    vi.advanceTimersByTime(340);
    expect(onRest).toHaveBeenCalledTimes(1);
    renderer.dispose();
    expect(vi.getTimerCount()).toBe(0);
    expect(object.style.visibility).toBe('hidden');
  });
});
