import { describe, expect, it } from 'vitest';
import { createDeskPetShakeController, createShakeDetector, type ShakeClock, type ShakeSnapshot } from '../lib/deskpet-shake';

function clock() {
  let now = 0, next = 0;
  const tasks = new Map<number, { at: number; callback: () => void }>();
  const api: ShakeClock = {
    now: () => now,
    setTimeout: (callback, ms) => {
      tasks.set(++next, { at: now + ms, callback });
      return next as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: id => { tasks.delete(id as unknown as number); },
  };
  return {
    api,
    size: () => tasks.size,
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const first = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
        if (!first || first[1].at > end) break;
        tasks.delete(first[0]); now = first[1].at; first[1].callback();
      }
      now = end;
    },
  };
}
const trace = [80, -80, 80, -80];
function gesture(controller: ReturnType<typeof createDeskPetShakeController>, time: ReturnType<typeof clock>, pointer = 1) {
  controller.begin(pointer, { x: 0, y: 0, t: time.api.now() }, 180);
  return trace.map(x => { time.advance(100); return controller.move(pointer, { x, y: 0, t: time.api.now() }); });
}
function detect(points: { x: number; y: number; t: number }[], width = 180) {
  const detector = createShakeDetector();
  detector.start({ x: 0, y: 0, t: 0 }, width);
  return points.map(point => detector.move(point));
}

describe('rapid back-and-forth gesture, using actual coordinate/time sequences', () => {
  it('requires three full fast reversals before triggering', () => {
    expect(detect(trace.map((x, i) => ({ x, y: 0, t: (i + 1) * 100 })))).toEqual([false, false, false, true]);
  });
  it('detects vertical and diagonal shaking', () => {
    expect(detect(trace.map((y, i) => ({ x: 0, y, t: (i + 1) * 100 })))[3]).toBe(true);
    expect(detect(trace.map((x, i) => ({ x, y: x, t: (i + 1) * 100 })))[3]).toBe(true);
  });
  it('does not trigger on fast one-way motion or ordinary slow zigzags', () => {
    expect(detect([100, 200, 300, 400, 500].map((x, i) => ({ x, y: 0, t: (i + 1) * 50 })))).not.toContain(true);
    expect(detect(trace.map((x, i) => ({ x, y: 0, t: (i + 1) * 500 })))).not.toContain(true);
  });
  it('does not trigger on micro-jitter, even with many high-frequency reversals', () => {
    expect(detect(Array.from({ length: 100 }, (_, i) => ({ x: i % 2 ? -3 : 3, y: 0, t: (i + 1) * 5 })))).not.toContain(true);
  });
  it('rejects tiny fast legs with insufficient overall travel and scales amplitude with pet size', () => {
    expect(detect([25, 0, 25, 0].map((x, i) => ({ x, y: 0, t: (i + 1) * 20 })))).not.toContain(true);
    expect(detect([25, -25, 25, -25].map((x, i) => ({ x, y: 0, t: (i + 1) * 30 })), 400)).not.toContain(true);
  });
  it('does not accumulate turns across pauses outside the rolling window', () => {
    expect(detect([{ x: 80, y: 0, t: 100 }, { x: -80, y: 0, t: 200 }, { x: 80, y: 0, t: 1500 }, { x: -80, y: 0, t: 1600 }])).not.toContain(true);
  });
  it('ignores invalid and out-of-order samples', () => {
    expect(detect([{ x: NaN, y: 0, t: 20 }, { x: 80, y: 0, t: -1 }, { x: 80, y: 0, t: 0 }])).toEqual([false, false, false]);
  });
});

describe('stop-driven recovery, independent of releasing the mouse', () => {
  it('starts recovery after 280ms silence while still held, then finishes exactly 3s later', () => {
    const time = clock(), changes: ShakeSnapshot[] = [];
    const pet = createDeskPetShakeController({ clock: time.api, onChange: s => changes.push(s) });
    expect(gesture(pet, time)).toEqual([false, false, false, true]);
    time.advance(279); expect(pet.snapshot().phase).toBe('dizzy');
    time.advance(1); expect(pet.snapshot().phase).toBe('recovering');
    time.advance(2999); expect(pet.snapshot().phase).toBe('recovering');
    time.advance(1); expect(pet.snapshot().phase).toBe('idle');
    expect(changes.map(s => s.phase)).toEqual(['dizzy', 'recovering', 'idle']);
    expect(time.size()).toBe(0);
  });
  it('pointerup neither starts, interrupts, resets nor replays recovery', () => {
    const time = clock(), pet = createDeskPetShakeController({ clock: time.api });
    gesture(pet, time); pet.end(1); time.advance(280); time.advance(1000);
    const before = pet.snapshot(); pet.end(1); expect(pet.snapshot()).toEqual(before);
    time.advance(2000); expect(pet.snapshot().phase).toBe('idle');
  });
  it('a brief pause is debounced and renewed qualified reversals postpone recovery', () => {
    const time = clock(), pet = createDeskPetShakeController({ clock: time.api });
    gesture(pet, time); time.advance(150);
    expect(pet.move(1, { x: 80, y: 0, t: time.api.now() })).toBe(true);
    time.advance(150); expect(pet.snapshot().phase).toBe('dizzy');
    time.advance(130); expect(pet.snapshot().phase).toBe('recovering');
  });
  it('resumes from the current recovery level without an instantaneous jump', () => {
    const time = clock(), pet = createDeskPetShakeController({ clock: time.api });
    gesture(pet, time); time.advance(280); time.advance(1100);
    pet.begin(1, { x: 0, y: 0, t: time.api.now() }, 180);
    for (const x of trace.slice(0, 3)) { time.advance(100); pet.move(1, { x, y: 0, t: time.api.now() }); }
    time.advance(100); const before = pet.snapshot().level;
    expect(pet.move(1, { x: -80, y: 0, t: time.api.now() })).toBe(true);
    expect(pet.snapshot().level).toBeCloseTo(before, 10);
    time.advance(90); expect(pet.snapshot().level).toBeGreaterThan(before);
    expect(pet.snapshot().level).toBeLessThan(1);
    time.advance(190); time.advance(3000); expect(pet.snapshot().phase).toBe('idle');
  });
  it('ignores other pointer IDs and motion after release', () => {
    const time = clock(), pet = createDeskPetShakeController({ clock: time.api });
    pet.begin(1, { x: 0, y: 0, t: 0 }, 180);
    for (const [i, x] of trace.entries()) expect(pet.move(2, { x, y: 0, t: (i + 1) * 100 })).toBe(false);
    pet.end(1); expect(pet.move(1, { x: 80, y: 0, t: 600 })).toBe(false);
    expect(pet.snapshot().phase).toBe('idle');
  });
  it('cancel and disposal clear both timers, stale recovery, and future input', () => {
    const time = clock(), changes: ShakeSnapshot[] = [];
    const pet = createDeskPetShakeController({ clock: time.api, onChange: s => changes.push(s) });
    gesture(pet, time); pet.cancel(); expect(time.size()).toBe(0);
    gesture(pet, time); time.advance(280); pet.dispose(); const count = changes.length;
    time.advance(5000); pet.begin(1, { x: 0, y: 0, t: time.api.now() }, 180);
    expect(pet.move(1, { x: 80, y: 0, t: time.api.now() + 100 })).toBe(false);
    expect(time.size()).toBe(0); expect(changes).toHaveLength(count);
  });
  it('exposes reduced-motion guidance without shortening the recovery semantics', () => {
    const time = clock(), pet = createDeskPetShakeController({ clock: time.api, reducedMotion: true });
    gesture(pet, time); expect(pet.snapshot().reducedMotion).toBe(true);
    time.advance(280 + 2999); expect(pet.snapshot().phase).toBe('recovering');
    time.advance(1); expect(pet.snapshot().phase).toBe('idle');
  });
  it('supports configurable gesture thresholds and recovery duration', () => {
    const time = clock(), pet = createDeskPetShakeController({ clock: time.api, config: { stopGapMs: 100, recoveryMs: 500 } });
    gesture(pet, time); time.advance(100); expect(pet.snapshot().phase).toBe('recovering');
    time.advance(500); expect(pet.snapshot().phase).toBe('idle');
  });
});
