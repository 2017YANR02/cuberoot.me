import { afterEach, describe, expect, it, vi } from 'vitest';
import { NetRoomController, startNetRoomPolling, startNetRoomRestore, type NetRoomState } from '@cuberoot/shared/timer';

const auth = { playerId: 'abcdef', playerToken: 'a'.repeat(48) };
function room(patch: Partial<NetRoomState> = {}): NetRoomState {
  return { code: '1234', revision: 1, videoGeneration: '11111111-1111-4111-8111-111111111111',
    round: 1, roundRoster: [], event: '333', scrambles: { '333': 'R' },
    players: { abcdef: { name: 'Cuber', joined: 1, seen: 10, ph: 'idle', at: 0, event: '333' } },
    results: { '1': {} }, history: [], scores: { abcdef: 0 }, admin: 'abcdef', syncStart: false, startAt: null, now: 10, ...patch };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup() {
  const controller = new NetRoomController();
  const onState = vi.fn(), onError = vi.fn(), onGone = vi.fn();
  controller.callbacks = { onState, onError, onGone, isTiming: () => false };
  controller.activate(room(), auth);
  return { controller, onState, onError, onGone };
}
afterEach(() => vi.useRealTimers());

describe('shared room lifecycle', () => {
  it('ignores old responses and retries after leaving and rejoining the same code', async () => {
    const { controller, onState, onError, onGone } = setup();
    const old = deferred<NetRoomState>();
    const request = vi.fn(() => old.promise);
    const pending = controller.execute(request, { retries: 1 });
    controller.deactivate(); controller.activate(room(), { ...auth, playerToken: 'b'.repeat(48) });
    old.reject(new Error('invalid player capability'));
    await pending;
    expect(request).toHaveBeenCalledTimes(1);
    expect(onState).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled(); expect(onGone).not.toHaveBeenCalled();
  });
  it('serializes polls and retains membership across a transient outage', async () => {
    const { controller, onGone, onState } = setup();
    const first = deferred<NetRoomState>();
    const get = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(room({ revision: 2 }));
    const pending = controller.poll(get);
    await controller.poll(get);
    expect(get).toHaveBeenCalledTimes(1);
    first.reject(new Error('Failed to fetch')); await pending;
    await controller.poll(get);
    expect(onGone).not.toHaveBeenCalled();
    expect(onState.mock.lastCall?.[0].revision).toBe(2);
    await controller.poll(async () => { throw new Error('room not found'); });
    expect(onGone).toHaveBeenCalledWith('room not found');
  });
  it('holds the round, merges final history, and advances even when polling wins the response race', async () => {
    const { controller, onState } = setup();
    const next = deferred<NetRoomState>();
    const pending = controller.advance(() => next.promise);
    const round2 = room({ round: 2, revision: 3, now: 120, results: { '2': {} },
      history: [{ round: 1, scrambles: { '333': 'R' }, playerEvents: { abcdef: '333' }, results: { abcdef: { t: 1000, p: '+2' } }, winners: ['abcdef'] }] });
    await controller.poll(async () => round2);
    expect(onState.mock.lastCall?.[0]).toMatchObject({ round: 1, results: { '1': { abcdef: { t: 1000, p: '+2' } } } });
    next.resolve({ ...round2, revision: 2, now: 110 }); await pending;
    expect(onState.mock.lastCall?.[0]).toMatchObject({ round: 2, revision: 3 });
  });
  it('keeps an active attempt on its round and exits immediately on removal', async () => {
    const { controller, onState, onGone } = setup();
    controller.callbacks.isTiming = () => true;
    const next = vi.fn(async () => room({ round: 2, revision: 2 }));
    await controller.advance(next); expect(next).not.toHaveBeenCalled();
    await controller.poll(next); expect(onState.mock.lastCall?.[0].round).toBe(1);
    await controller.poll(async () => room({ round: 2, revision: 3, players: {} }));
    expect(onGone).toHaveBeenCalledWith('removed from room');
  });
  it('serializes result retry before a newer penalty so the old value cannot overwrite it', async () => {
    const { controller } = setup();
    const first = deferred<NetRoomState>();
    const order: string[] = [];
    const original = vi.fn().mockImplementationOnce(() => { order.push('ok'); return first.promise; })
      .mockImplementationOnce(async () => { order.push('ok retry'); return room({ revision: 2 }); });
    const initial = controller.submitResult(1, original, { t: 1000, p: 'ok' });
    await Promise.resolve();
    const penalty = controller.submitResult(1, async () => { order.push('+2'); return room({ revision: 3 }); }, { t: 1000, p: '+2' });
    expect(order).toEqual(['ok']);
    first.reject(new Error('Failed to fetch'));
    await Promise.all([initial, penalty]);
    expect(order).toEqual(['ok', 'ok retry', '+2']);
  });
  it('reports a late result rejected by the server instead of claiming it was submitted', async () => {
    const { controller, onError } = setup();
    const result = await controller.submitResult(1, async () => ({ ...room({ round: 2, revision: 2 }), advanced: true }), { t: 1000, p: 'ok' });
    expect(result).toBe(false); expect(onError).toHaveBeenCalledWith(new Error('result rejected'));
  });
  it('pauses hidden polling and wakes without overlapping on reconnect', async () => {
    vi.useFakeTimers();
    const { controller } = setup(); let visible = false; let wake = () => {};
    const unsubscribe = vi.fn(); const get = vi.fn(async () => room());
    const stop = startNetRoomPolling(controller, get, { visible: () => visible, subscribeWake: fn => { wake = fn; return unsubscribe; } });
    await vi.advanceTimersByTimeAsync(1000); expect(get).not.toHaveBeenCalled();
    visible = true; wake(); await Promise.resolve(); expect(get).toHaveBeenCalledTimes(1);
    stop(); await vi.advanceTimersByTimeAsync(2000); expect(get).toHaveBeenCalledTimes(1); expect(unsubscribe).toHaveBeenCalledOnce();
  });
  it('retries restoring the same saved identity after an outage without clearing or joining again', async () => {
    vi.useFakeTimers(); const session = { ...auth, code: '1234', name: 'Cuber' };
    const clear = vi.fn(async () => {}), restored = vi.fn(), missing = vi.fn(), error = vi.fn();
    const getRoom = vi.fn().mockRejectedValueOnce(new Error('Failed to fetch')).mockResolvedValue(room());
    const stop = startNetRoomRestore({ current: () => true, load: async () => session, getRoom, clear, restored, missing, error });
    await vi.advanceTimersByTimeAsync(1000);
    expect(getRoom).toHaveBeenCalledTimes(2); expect(restored).toHaveBeenCalledWith(session, room());
    expect(clear).not.toHaveBeenCalled(); expect(missing).not.toHaveBeenCalled(); stop();
  });
  it('clears invalid restored credentials but cancels late restoration when a new admission starts', async () => {
    vi.useFakeTimers(); const session = { ...auth, code: '1234', name: 'Cuber' };
    const clear = vi.fn(async () => {}), restored = vi.fn(), missing = vi.fn();
    let current = true; const response = deferred<NetRoomState>();
    const stop = startNetRoomRestore({ current: () => current, load: async () => session, getRoom: () => response.promise, clear, restored, missing, error: vi.fn() });
    await Promise.resolve(); current = false; response.reject(new Error('invalid player capability'));
    await vi.advanceTimersByTimeAsync(1000); expect(clear).not.toHaveBeenCalled(); expect(restored).not.toHaveBeenCalled(); stop();
    const stop2 = startNetRoomRestore({ current: () => true, load: async () => session, getRoom: async () => { throw new Error('invalid player capability'); }, clear, restored, missing, error: vi.fn() });
    await vi.advanceTimersByTimeAsync(0); expect(clear).toHaveBeenCalledOnce(); expect(missing).not.toHaveBeenCalled(); stop2();
  });
});
