import { afterEach, describe, expect, it, vi } from 'vitest';

import { dropRustCrossPool, getRustCrossPool, isRustCrossPoolReady } from '@/lib/rust-cross-pool';
import { readFileSync } from 'node:fs';

class ReadyWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  postMessage(message: { type?: string }): void {
    if (message.type !== 'init') return;
    queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } } as MessageEvent));
  }

  terminate(): void {}
}

describe('timer solver loading state', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the shared pool ready across a solver remount', async () => {
    vi.stubGlobal('Worker', ReadyWorker);
    const pool = getRustCrossPool('cross', 1);

    expect(pool.isReady()).toBe(false);
    expect(isRustCrossPoolReady('cross')).toBe(false);
    await pool.ready;
    expect(pool.isReady()).toBe(true);
    expect(isRustCrossPoolReady('cross')).toBe(true);
    expect(getRustCrossPool('cross', 1)).toBe(pool);
    dropRustCrossPool();
  });

  it('uses the shared ready state instead of showing first-load UI on remount', () => {
    const source = readFileSync(new URL('../components/StageSolver.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(/if \(pool\.isReady\(\)\) \{[\s\S]*?setStatus\('ready'\)[\s\S]*?\} else \{[\s\S]*?setStatus\('loading'\)/);
  });
});
