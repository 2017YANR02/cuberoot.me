import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDizzyRenderer, restartIdleDocument } from '../lib/deskpet-dizzy';
import type { ShakeSnapshot } from '../lib/deskpet-shake';

function fixture() {
  const values = new Map<string, string>(), attrs = new Map([['data-rootbeast-dizzy', 'loop']]);
  const style = { animationPlayState: '', setProperty: (key: string, value: string) => values.set(key, value) };
  const svg = { localName: 'svg', style, getAttribute: (key: string) => attrs.get(key),
    setAttribute: (key: string, value: string) => attrs.set(key, value), removeAttribute: (key: string) => attrs.delete(key),
    querySelectorAll: () => [] };
  const object = Object.assign(new EventTarget(), { style: { visibility: '' }, contentDocument: { documentElement: svg } });
  let snapshot: ShakeSnapshot = { phase: 'idle', level: 0, recoveryProgress: 0, reducedMotion: false };
  const onShow = vi.fn(), onRest = vi.fn(), onHandoff = vi.fn(), onUnavailable = vi.fn();
  const renderer = createDizzyRenderer({ object: object as unknown as HTMLObjectElement, snapshot: () => snapshot,
    reducedMotion: () => snapshot.reducedMotion, interrupted: () => false, onShow, onRest, onHandoff, onUnavailable });
  return { renderer, values, attrs, object, svg, onShow, onRest, onHandoff,
    update(s: Partial<ShakeSnapshot>) { snapshot = { ...snapshot, ...s }; renderer.sync(); } };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('sets variables inside the embedded SVG document, preserving document identity', () => {
  const f = fixture(), document = f.object.contentDocument;
  expect(f.values.get('--dizzy-level')).toBe('0');
  f.update({ phase: 'dizzy', level: .4 });
  expect(f.values.get('--dizzy-level')).toBe('0.400000');
  f.update({ phase: 'recovering', level: .2 });
  expect(f.values.get('--dizzy-level')).toBe('0.200000');
  expect(f.values.get('--dizzy-accent')).toBe('1');
  expect(f.object.contentDocument).toBe(document); expect(f.onShow).toHaveBeenCalledOnce(); f.renderer.dispose();
});
it('holds the last vector until the replacement paints and only requests rest once', () => {
  const f = fixture(); f.update({ phase: 'dizzy', level: 1 }); f.update({ phase: 'idle', level: 0 }); f.renderer.sync();
  expect(f.object.style.visibility).toBe(''); expect(f.onRest).toHaveBeenCalledOnce();
  f.renderer.hide(); expect(f.object.style.visibility).toBe('hidden'); expect(vi.getTimerCount()).toBe(0); f.renderer.dispose();
});
it('sets reduced-motion overrides in the SVG and cleans animation frames on disposal', () => {
  const f = fixture(); f.update({ phase: 'dizzy', level: 1, reducedMotion: true });
  expect(f.attrs.get('data-dizzy-motion')).toBe('reduce');
  f.renderer.dispose(); expect(vi.getTimerCount()).toBe(0); expect(f.svg.style.animationPlayState).toBe('paused');
});
it('ignores document loads after disposal', () => {
  const f = fixture(); f.renderer.dispose(); f.object.dispatchEvent(new Event('load'));
  expect(f.renderer.ready).toBe(false); expect(f.onShow).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('resets actual idle animation timelines without reloading the document', () => {
  const animations = [{ currentTime: 1200 }, { currentTime: 600 }], setCurrentTime = vi.fn();
  const object = { contentDocument: { documentElement: { setCurrentTime, getAnimations: () => animations } } };
  restartIdleDocument(object as unknown as HTMLObjectElement);
  expect(setCurrentTime).toHaveBeenCalledWith(0); expect(animations.map(a => a.currentTime)).toEqual([0, 0]);
});
