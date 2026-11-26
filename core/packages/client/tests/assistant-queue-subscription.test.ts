import { afterEach, describe, expect, it, vi } from 'vitest';
import { assistantQueueRequest, watchAssistantQueue } from '../lib/assistant-queue';
import { subscribeAssistantQueue } from '../lib/assistant-queue-subscription';
import type { AssistantQueueSnapshot } from '@cuberoot/shared/site-assistant';

vi.mock('../lib/assistant-queue', () => ({ assistantQueueRequest: vi.fn(), watchAssistantQueue: vi.fn() }));
afterEach(() => { vi.resetAllMocks(); vi.useRealTimers(); });

const snapshot = (revision: number): AssistantQueueSnapshot => ({
  conversationId: 'chat', activeId: 'task', paused: false, recovering: false, messages: [], revision,
});

describe('queue snapshot ownership and ordering', () => {
  it('rejects an older poll after a live update and polls the latest revision after disconnect', async () => {
    vi.useFakeTimers();
    const pendingRead = Promise.withResolvers<AssistantQueueSnapshot>();
    const stream = Promise.withResolvers<void>();
    vi.mocked(assistantQueueRequest).mockResolvedValueOnce(snapshot(1)).mockReturnValueOnce(pendingRead.promise);
    vi.mocked(watchAssistantQueue).mockReturnValue(stream.promise);
    let revision = 0;
    const seen: number[] = [];
    const stop = subscribeAssistantQueue('chat', {
      initialActive: true, background: false, isCurrentOwner: () => true, revision: () => revision,
      onSnapshot: value => { revision = value.revision; seen.push(revision); },
    });
    try {
      await vi.advanceTimersByTimeAsync(1000);
      const onChange = vi.mocked(watchAssistantQueue).mock.calls[0][2];
      onChange(snapshot(3));
      pendingRead.resolve(snapshot(2));
      await vi.advanceTimersByTimeAsync(0);
      expect(seen).toEqual([1, 3]);
      stream.reject(new Error('connection lost'));
      await vi.advanceTimersByTimeAsync(35);
      expect(vi.mocked(assistantQueueRequest).mock.lastCall?.[5]).toBe(3);
      expect(vi.mocked(assistantQueueRequest).mock.calls[0][5]).toBeUndefined();
    } finally { stop(); }
  });

  it('discards both transports after an owner change and cancels outstanding work on cleanup', async () => {
    vi.useFakeTimers();
    const pendingRead = Promise.withResolvers<AssistantQueueSnapshot>();
    vi.mocked(assistantQueueRequest).mockResolvedValueOnce(snapshot(1)).mockReturnValueOnce(pendingRead.promise);
    vi.mocked(watchAssistantQueue).mockReturnValue(new Promise(() => {}));
    let currentOwner = true;
    const onSnapshot = vi.fn();
    const stop = subscribeAssistantQueue('chat', {
      initialActive: false, background: false, isCurrentOwner: () => currentOwner, revision: () => 1, onSnapshot,
    });
    await vi.advanceTimersByTimeAsync(1000);
    const [, streamSignal, onChange] = vi.mocked(watchAssistantQueue).mock.calls[0];
    currentOwner = false;
    onChange(snapshot(4));
    pendingRead.resolve(snapshot(5));
    await vi.advanceTimersByTimeAsync(0);
    stop();
    expect(streamSignal.aborted).toBe(true);
    expect(vi.mocked(assistantQueueRequest).mock.lastCall?.[3]?.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(assistantQueueRequest).toHaveBeenCalledTimes(2);
  });
});
