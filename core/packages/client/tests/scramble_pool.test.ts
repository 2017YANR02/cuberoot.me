import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { takeScramble, _resetScramblePool } from '@/app/[lang]/timer/_lib/scramble/scramble_pool';

// The pool refills during requestIdleCallback; run it synchronously so the
// buffer fills deterministically within each takeScramble() call.
beforeEach(() => {
  (globalThis as unknown as { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback =
    (cb: () => void) => { cb(); return 0; };
  _resetScramblePool();
});
afterEach(() => {
  delete (globalThis as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
});

describe('scramble_pool', () => {
  it('serves the pre-generated sequence in order (buffer hand-off)', () => {
    let n = 0;
    const gen = () => `s${n++}`;
    const ok = () => true;
    // First take is dry → generates s0, then the buffer fills s1..s5 ahead.
    expect(takeScramble('k', gen, ok)).toBe('s0');
    // Subsequent takes are served instantly from the buffer, in order.
    expect(takeScramble('k', gen, ok)).toBe('s1');
    expect(takeScramble('k', gen, ok)).toBe('s2');
    expect(takeScramble('k', gen, ok)).toBe('s3');
  });

  it('keeps a buffer ahead so generation runs before consumption', () => {
    const gen = vi.fn(() => 'x');
    takeScramble('k', gen, () => true);
    // 1 synchronous (dry) + 5 refilled ahead = TARGET reached.
    expect(gen).toHaveBeenCalledTimes(6);
  });

  it('discards the buffer when the context key changes', () => {
    let n = 0;
    const gen = () => `s${n++}`;
    takeScramble('a', gen, () => true); // s0 + fill a:[s1..s5]
    // New key → old buffer dropped, fresh synchronous generate (no stale s1).
    expect(takeScramble('b', gen, () => true)).toBe('s6');
  });

  it('pauses background refill when canGen() is false, resumes when true', () => {
    let n = 0;
    const gen = vi.fn(() => `s${n++}`);
    // Unsafe phase (e.g. timer running) → only the synchronous dry generate runs.
    expect(takeScramble('k', gen, () => false)).toBe('s0');
    expect(gen).toHaveBeenCalledTimes(1);
    expect(takeScramble('k', gen, () => false)).toBe('s1');
    expect(gen).toHaveBeenCalledTimes(2);
    // Phase becomes safe → buffer fills ahead again.
    expect(takeScramble('k', gen, () => true)).toBe('s2');
    expect(takeScramble('k', gen, () => true)).toBe('s3'); // served from buffer
  });
});
