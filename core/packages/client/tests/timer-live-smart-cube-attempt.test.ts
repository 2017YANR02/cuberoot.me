// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useLiveSmartCubeAttempt } from '@cuberoot/timer-ui';
import { SmartCubeAttemptProducer } from '@cuberoot/shared/timer/smart-cube-attempt';

it('coalesces live presentation without losing turns and rejects stale attempt snapshots', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const producer = new SmartCubeAttemptProducer();
  let context: { startedAt: number; event: '333'; scramble: string } | null = { startedAt: 100, event: '333', scramble: 'R' };
  let live!: ReturnType<typeof useLiveSmartCubeAttempt>;
  function Harness() { live = useLiveSmartCubeAttempt(producer, () => context); return null; }
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(Harness)));
    producer.begin(100, { model: 'moyu32', name: 'WCU_MY32_A1B2' });
    await act(async () => {
      producer.recordMove('R', 110); live.publish();
      producer.recordMove('U', 120); live.publish();
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(live.solve?.moves?.map(move => move.m)).toEqual(['R', 'U']);
    expect(producer.snapshotMoves()).toHaveLength(2);
    const previous = live.solve;
    await act(async () => {
      producer.recordMove('F', 230); live.publish();
      context = null;
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(live.solve).toBe(previous);
    await act(async () => live.clear());
    expect(live.solve).toBeNull();
  } finally {
    await act(async () => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers(); vi.unstubAllGlobals();
  }
});
