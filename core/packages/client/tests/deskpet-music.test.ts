// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createMusicRenderer } from '@/lib/deskpet-music';

afterEach(() => vi.useRealTimers());
describe('music rig state subscription', () => {
  it('reverses one document, cancels stale completion and unsubscribes', () => {
    vi.useFakeTimers();
    const object = document.createElement('object');
    const doc = new DOMParser().parseFromString(readFileSync(path.join(process.cwd(),
      'public/deskpet/rootbeast-motion/rootbeast-music-rig-v3.svg'), 'utf8'), 'image/svg+xml');
    Object.defineProperty(object, 'contentDocument', { value: doc });
    let state = { playing: false, currentId: 'a', error: null as string | null };
    let listener = () => {};
    const off = vi.fn(), onRest = vi.fn();
    const renderer = createMusicRenderer({ object, read: () => state,
      subscribe: fn => { listener = fn; return off; }, blocked: () => false,
      reducedMotion: () => false, onShow: vi.fn(), onRest, onUnavailable: vi.fn() });
    expect(object.style.visibility).toBe('hidden');
    state = { ...state, playing: true }; listener();
    expect(doc.documentElement.getAttribute('data-music')).toBe('on');
    vi.advanceTimersByTime(600);
    state = { ...state, playing: false }; listener();
    expect(doc.documentElement.hasAttribute('data-music')).toBe(false);
    vi.advanceTimersByTime(600);
    state = { ...state, playing: true }; listener();
    vi.advanceTimersByTime(1600);
    expect(onRest).not.toHaveBeenCalled();
    expect(object.contentDocument).toBe(doc);
    renderer.dispose();
    expect(off).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
