// Ported from huazhechen/cuber (MIT) — src/cuber/tweener.ts
import { elapsedMsToSimTicks } from '../support/sim-timing';

export type TweenEasing = 'ease-out' | 'linear';
type FrameListener = (frameMs: number, dtMs: number) => void;

export class Tween {
  value = 0;
  private current: number;
  private lastUpdateMs: number;

  constructor(
    public begin: number,
    public end: number,
    public duration: number,
    public callback: (v: number) => boolean | void,
    public easing: TweenEasing = 'ease-out',
    startedAtMs = performance.now(),
  ) {
    this.current = begin;
    this.lastUpdateMs = startedAtMs;
  }

  finish(): void { this.callback(this.end); }

  /** Wall time belongs to this animation, never to an earlier global frame. */
  updateAt(frameMs: number, paused = false): boolean {
    const elapsed = Math.max(0, frameMs - this.lastUpdateMs);
    this.lastUpdateMs = Math.max(frameMs, this.lastUpdateMs);
    return !paused && this.update(elapsedMsToSimTicks(elapsed));
  }

  get remainingTicks(): number { return Math.max(0, this.duration - this.value); }

  /** Shorten the remaining path without changing the currently displayed angle. */
  shortenRemaining(ticks: number): void {
    if (!Number.isFinite(ticks) || ticks <= 0 || ticks >= this.remainingTicks) return;
    this.begin = this.current;
    this.duration = ticks;
    this.value = 0;
    this.lastUpdateMs = performance.now();
  }

  /** Deterministic manual ticks remain available to headless/video exporters. */
  update(deltaTicks = 1): boolean {
    if (!Number.isFinite(deltaTicks) || deltaTicks <= 0) return false;
    this.value += deltaTicks;
    const progress = Math.max(0, Math.min(1, this.value / this.duration));
    const eased = this.easing === 'linear' ? progress : 1 - (1 - progress) ** 2;
    this.current = progress === 1 ? this.end : this.begin + (this.end - this.begin) * eased;
    return this.callback(this.current) === true;
  }
}

export class Tweener {
  tweens: Tween[] = [];
  /** Exporters pause wall-clock advancement while driving manual ticks. */
  paused = false;
  private raf: number | null = null;
  private lastFrameMs: number | null = null;
  private readonly frames = new Set<FrameListener>();

  get length(): number { return this.tweens.length; }

  /** One coordinator advances every tween once, then updates/draws each view. */
  subscribeFrame(listener: FrameListener): () => void {
    this.frames.add(listener);
    this.wake();
    return () => { this.frames.delete(listener); this.stopIfIdle(); };
  }

  private wake(): void {
    if (this.raf !== null || typeof requestAnimationFrame === 'undefined') return;
    this.raf = requestAnimationFrame(this.loop);
  }

  private stopIfIdle(): void {
    if (this.tweens.length || this.frames.size) return;
    if (this.raf !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf);
    this.raf = null;
    this.lastFrameMs = null;
  }

  loop = (frameMs: number): void => {
    this.raf = null;
    const dtMs = this.lastFrameMs === null ? 0 : Math.max(0, frameMs - this.lastFrameMs);
    this.lastFrameMs = frameMs;
    // Snapshot: finishing a layer can enqueue the next one. That new animation
    // must not inherit the elapsed interval of the layer which just finished.
    try {
      this.advance(tween => tween.updateAt(frameMs, this.paused));
      for (const listener of this.frames) listener(frameMs, dtMs);
    } finally {
      if (this.tweens.length || this.frames.size) this.wake();
      else this.stopIfIdle();
    }
  };

  tween(begin: number, end: number, duration: number, update: (v: number) => boolean | void,
    easing: TweenEasing = 'ease-out'): Tween {
    const tween = new Tween(begin, end, duration, update, easing);
    this.tweens.push(tween);
    this.wake();
    return tween;
  }

  private advance(update: (tween: Tween) => boolean): boolean {
    const active = this.tweens.slice();
    for (const tween of active) {
      if (!this.tweens.includes(tween) || !update(tween)) continue;
      const index = this.tweens.indexOf(tween);
      if (index !== -1) this.tweens.splice(index, 1);
    }
    return active.length > 0;
  }

  update(deltaTicks = 1): boolean {
    const advanced = this.advance(tween => tween.update(deltaTicks));
    this.stopIfIdle();
    return advanced;
  }

  finish(tween?: Tween): void {
    const finishing = tween ? (this.tweens.includes(tween) ? [tween] : []) : this.tweens.slice();
    for (const current of finishing) {
      this.cancel(current);
      current.finish();
    }
    this.stopIfIdle();
  }

  cancel(tween: Tween): void {
    const index = this.tweens.indexOf(tween);
    if (index !== -1) this.tweens.splice(index, 1);
    this.stopIfIdle();
  }
}

const tweener = new Tweener();
export default tweener;
