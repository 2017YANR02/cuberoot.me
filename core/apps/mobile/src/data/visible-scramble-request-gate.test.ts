import { describe, expect, it } from 'vitest';
import { createTimerAsyncScramblePool } from '@cuberoot/shared/timer';
import { MobileVisibleScrambleRequestGate } from './visible-scramble-request-gate';

describe('mobile visible scramble request gate', () => {
  it('A/B/A cleanup removes stale same-key waiters before current A resolves', async () => {
    const resolvers: Array<(value: string) => void> = [];
    const pool = createTimerAsyncScramblePool<string>({
      targetSize: 3,
      generate: () => new Promise<string>((resolve) => resolvers.push(resolve)),
    });
    const gate = new MobileVisibleScrambleRequestGate();

    const staleA = gate.begin();
    const staleAPromise = pool.next('A', staleA.signal);
    const staleB = gate.begin();
    const staleBPromise = pool.next('B', staleB.signal);
    const currentA = gate.begin();
    const currentAPromise = pool.next('A', currentA.signal);

    await expect(staleAPromise).resolves.toBe('');
    await expect(staleBPromise).resolves.toBe('');
    // A's three underlying fills are still useful. The cancelled first A
    // waiter no longer consumes A-1, so the current visible A gets it.
    resolvers[0]('A-1');
    await expect(currentAPromise).resolves.toBe('A-1');
    gate.finish(currentA);
    pool.dispose();
  });
});
