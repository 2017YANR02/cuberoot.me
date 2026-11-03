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

it('disables pending and future analysis while preserving recording, then resumes the full attempt', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const producer = new SmartCubeAttemptProducer();
  producer.begin(100, { model: 'gan-v4', name: 'Test cube' });
  const snapshot = vi.spyOn(producer, 'snapshotLive');
  let live!: ReturnType<typeof useLiveSmartCubeAttempt>;
  function Harness({ enabled }: { enabled: boolean }) {
    live = useLiveSmartCubeAttempt(producer, () => ({ startedAt: 100, event: '333', scramble: 'R' }), enabled);
    return null;
  }
  const root = createRoot(document.createElement('div'));
  try {
    await act(async () => root.render(createElement(Harness, { enabled: true })));
    producer.recordMove('R', 110); live.publish();
    await act(async () => root.render(createElement(Harness, { enabled: false })));
    producer.recordMove('U', 120); live.publish();
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(live.solve).toBeNull();
    expect(snapshot).not.toHaveBeenCalled();
    expect(producer.snapshotMoves()).toHaveLength(2);
    await act(async () => root.render(createElement(Harness, { enabled: true })));
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(live.solve?.moves?.map(move => move.m)).toEqual(['R', 'U']);
    await act(async () => root.render(createElement(Harness, { enabled: false })));
    expect(live.solve).toBeNull();
  } finally {
    await act(async () => root.unmount());
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers(); vi.unstubAllGlobals();
  }
});
