/** Buffered, serial cloud-optimal 3x3 source shared by every timer host. */

const TARGET = 3;

export interface Optimal333Source {
  /** Changes whenever the generated-state rules or signed-in owner changes. */
  key: string;
  generateBase: (signal: AbortSignal) => Optimal333BaseResult | Promise<Optimal333BaseResult>;
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
let buffer = emptyBuffer();
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
  if (buffer.key !== source.key) {
    controller?.abort();
    controller = null;
    buffer = { key: source.key, source, queue: [], error: null };
    notify();
  } else {
    buffer.source = source;
  }
  return buffer;
}

function statusFor(key: string): Optimal333Status {
  if (buffer.key !== key || !buffer.source) return 'idle';
  if (buffer.queue.length > 0) return 'ready';
  if (buffer.error) return buffer.error;
  return 'working';
}

function raceAbort<T>(
  signal: AbortSignal,
  operation: () => T | Promise<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('optimal 3x3 generation aborted'));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(operation).then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', abort);
    });
  });
}

async function pump(): Promise<void> {
  if (pumping) return;
  pumping = true;
  try {
    for (;;) {
      const source = buffer.source;
      if (!source || buffer.error || buffer.queue.length >= TARGET) break;
      const key = source.key;
      const requestController = new AbortController();
      controller = requestController;
      try {
        const generated = await raceAbort(
          requestController.signal,
          () => source.generateBase(requestController.signal),
        );
        if (typeof generated !== 'string') {
          if (buffer.key !== key || requestController.signal.aborted) continue;
          buffer.error = generated.reason === 'empty' ? 'base-empty' : 'base-rare';
          notify();
          break;
        }
        const base = generated.trim();
        if (!base) throw new Error('empty base scramble');
        if (buffer.key !== key || requestController.signal.aborted) continue;
        const optimal = (await raceAbort(
          requestController.signal,
          () => source.optimize(base, requestController.signal),
        )).trim();
        if (!optimal) throw new Error('empty optimal scramble');
        if (buffer.key !== key || requestController.signal.aborted) continue;
        source.onOptimized?.(base, optimal);
        buffer.queue.push(optimal);
        notify();
      } catch {
        if (buffer.key !== key || requestController.signal.aborted) continue;
        // One visible retry beats an unbounded loop that burns cloud CPU.
        buffer.error = 'error';
        notify();
        break;
      } finally {
        if (controller === requestController) controller = null;
      }
    }
  } finally {
    pumping = false;
    if (buffer.source && !buffer.error && buffer.queue.length < TARGET) void pump();
  }
}

export function prefetchOptimal333(source: Optimal333Source): void {
  want(source);
  void pump();
}

export function peekOptimal333(source: Optimal333Source): string {
  const active = want(source);
  const scramble = active.queue.shift() ?? '';
  void pump();
  return scramble;
}

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
  const active = want(source);
  active.error = null;
  notify();
  void pump();
}

export function releaseOptimal333(): void {
  if (!buffer.source && !controller) return;
  controller?.abort();
  controller = null;
  buffer = emptyBuffer();
  notify();
}

/** Test hook. */
export function _resetOptimal333Pool(): void {
  releaseOptimal333();
  listeners.clear();
  pumping = false;
}
