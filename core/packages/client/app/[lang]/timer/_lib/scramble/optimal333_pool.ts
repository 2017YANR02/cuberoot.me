/**
 * Buffered cloud-optimal 3x3 random states for the solo timer.
 *
 * The cloud solver is intentionally kept to one request at a time. Once the
 * first scramble is ready, the same pump quietly fills the next three slots so
 * ordinary solve times are long enough to hide the following network/solve
 * latency without multiplying server concurrency per browser tab.
 */

const TARGET = 3;

export interface Optimal333Source {
  /** Changes whenever the generated-state rules or signed-in owner changes. */
  key: string;
  generateBase: () => Optimal333BaseResult | Promise<Optimal333BaseResult>;
  optimize: (scramble: string, signal: AbortSignal) => Promise<string>;
  onOptimized?: (base: string, optimal: string) => void;
}

export type Optimal333BaseResult = string | Readonly<{
  kind: 'unavailable';
  reason: 'empty' | 'rare';
}>;

export type Optimal333Status =
  | 'idle'
  | 'working'
  | 'ready'
  | 'error'
  | 'base-empty'
  | 'base-rare';

interface Buffer {
  key: string;
  source: Optimal333Source | null;
  queue: string[];
  error: Extract<Optimal333Status, 'error' | 'base-empty' | 'base-rare'> | null;
}

const emptyBuffer = (): Buffer => ({ key: '', source: null, queue: [], error: null });
let buf = emptyBuffer();
let pumping = false;
let controller: AbortController | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => { for (const listener of [...listeners]) listener(); };

export function canUseRandomOptimal333(
  event: string,
  source: string,
  authenticated: boolean,
  syncSeed: string | null,
): boolean {
  return event === '333' && source === 'random' && authenticated && !syncSeed;
}

export function shouldUseRandomOptimal333(
  enabled: boolean,
  event: string,
  source: string,
  authenticated: boolean,
  syncSeed: string | null,
): boolean {
  return enabled && canUseRandomOptimal333(event, source, authenticated, syncSeed);
}

function want(source: Optimal333Source): Buffer {
  if (buf.key !== source.key) {
    controller?.abort();
    controller = null;
    buf = { key: source.key, source, queue: [], error: null };
    notify();
  } else {
    buf.source = source;
  }
  return buf;
}

function statusFor(key: string): Optimal333Status {
  if (buf.key !== key || !buf.source) return 'idle';
  if (buf.queue.length > 0) return 'ready';
  if (buf.error) return buf.error;
  return 'working';
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    for (;;) {
      const source = buf.source;
      if (!source || buf.error || buf.queue.length >= TARGET) break;
      const key = source.key;
      const requestController = new AbortController();
      controller = requestController;
      try {
        const generated = await source.generateBase();
        if (typeof generated !== 'string') {
          if (buf.key !== key || requestController.signal.aborted) continue;
          buf.error = generated.reason === 'empty' ? 'base-empty' : 'base-rare';
          notify();
          break;
        }
        const base = generated.trim();
        if (!base) throw new Error('empty base scramble');
        if (buf.key !== key || requestController.signal.aborted) continue;
        const optimal = (await source.optimize(base, requestController.signal)).trim();
        if (!optimal) throw new Error('empty optimal scramble');
        if (buf.key !== key || requestController.signal.aborted) continue;
        source.onOptimized?.(base, optimal);
        buf.queue.push(optimal);
        notify();
      } catch {
        if (buf.key !== key || requestController.signal.aborted) continue;
        // Latch one visible error instead of retrying forever and burning cloud
        // CPU. The timer exposes an explicit retry action for this state.
        buf.error = 'error';
        notify();
        break;
      } finally {
        if (controller === requestController) controller = null;
      }
    }
  } finally {
    pumping = false;
    // A context switch can happen while the previous request is unwinding.
    // Re-enter once so the newly requested source is not left unstarted.
    if (buf.source && !buf.error && buf.queue.length < TARGET) void pump();
  }
}

/** Start filling this source without consuming its first ready scramble. */
export function prefetchOptimal333(source: Optimal333Source): void {
  want(source);
  void pump();
}

/** Synchronously take a ready scramble, or return an empty loading placeholder. */
export function peekOptimal333(source: Optimal333Source): string {
  const b = want(source);
  const scramble = b.queue.shift() ?? '';
  void pump();
  return scramble;
}

/** Wait until this source has a ready scramble or reaches a retryable error. */
export function awaitOptimal333(source: Optimal333Source): Promise<Optimal333Status> {
  const key = source.key;
  want(source);
  void pump();
  const settled = (): Optimal333Status | null => {
    const status = statusFor(key);
    return status === 'working' ? null : status;
  };
  const now = settled();
  if (now) return Promise.resolve(now);
  return new Promise((resolve) => {
    const listener = () => {
      const status = settled();
      if (status) {
        listeners.delete(listener);
        resolve(status);
      }
    };
    listeners.add(listener);
  });
}

export function retryOptimal333(source: Optimal333Source): void {
  const b = want(source);
  b.error = null;
  notify();
  void pump();
}

/** Stop current work and discard buffered states after leaving this mode. */
export function releaseOptimal333(): void {
  if (!buf.source && !controller) return;
  controller?.abort();
  controller = null;
  buf = emptyBuffer();
  notify();
}

/** Test hook. */
export function _resetOptimal333Pool(): void {
  releaseOptimal333();
  listeners.clear();
  pumping = false;
}
