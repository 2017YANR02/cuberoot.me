import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlgCase } from '@cuberoot/shared/alg';
import type { ClaimBatchResult } from '@/lib/trainer-room-api';

vi.mock('@/lib/trainer-room-api', () => ({
  createRoom: vi.fn(), getRoom: vi.fn(), claimRoomBatch: vi.fn(), nextRoundRoom: vi.fn(),
}));
vi.mock('@/lib/deskpet', () => ({ petReact: vi.fn() }));
vi.mock('@/lib/trainer-scramble', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/trainer-scramble')>(),
  cstimerStyleScramble: vi.fn(async () => null),
}));

function makeStorage() {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
    clear: () => data.clear(),
  };
}
const globals = globalThis as unknown as { window: unknown; localStorage: ReturnType<typeof makeStorage> };
globals.window = { location: { pathname: '/' }, addEventListener() {} };
globals.localStorage = makeStorage();

const { useTrainerStore, TimerState } = await import('@/lib/trainer-store');
const { caseKey } = await import('@/lib/trainer-case-key');
const api = await import('@/lib/trainer-room-api');
const { cstimerStyleScramble } = await import('@/lib/trainer-scramble');
const state = useTrainerStore.getState;
const cases = ['A', 'B', 'C', 'D', 'E', 'F'].map(name => ({
  subgroup: 'T', name, standard: "R U R' U'", setup: "U R U' R'",
  algs: [], sticker: { kind: 'pll' },
}) as unknown as AlgCase);
const keys = cases.map(caseKey);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const info = (code = '1234', set = 'pll') => ({
  code, puzzle: '3x3', set, order: 'seq' as const, round: 1, total: cases.length,
  claimed: 0, done: false,
});
const batch = (start = 0, count = 2): ClaimBatchResult => ({
  kind: 'cases', cases: keys.slice(start, start + count).map((key, offset) => ({ caseKey: key, index: start + offset })),
  round: 1, total: cases.length,
});
function boot(set = 'pll') {
  state().loadSession('3x3', set, cases);
  state().setSelected(keys);
  state().setScope(null);
}
let release: () => void;

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  globals.localStorage = makeStorage();
  vi.mocked(api.getRoom).mockImplementation(async code => info(code));
  vi.mocked(api.createRoom).mockResolvedValue(info());
  vi.mocked(api.claimRoomBatch).mockResolvedValue({ kind: 'done', round: 1, total: cases.length });
  vi.mocked(cstimerStyleScramble).mockResolvedValue(null);
  release = state().activateSessionScope();
  state().hydratePrefs();
  state().setScrambleKind('inv');
  boot();
});
afterEach(() => { release(); vi.useRealTimers(); });

describe('training surface ownership', () => {
  it('cancels a ready timeout so it cannot arm a subsequent surface', async () => {
    state().getTimerReady(100);
    release();
    release = state().activateSessionScope();
    state().getTimerReady(500);
    await vi.advanceTimersByTimeAsync(100);
    expect(state().timerState).toBe(TimerState.AWAITING_READY);
    await vi.advanceTimersByTimeAsync(400);
    expect(state().timerState).toBe(TimerState.READY);
  });

  it('leaving a running attempt does not save a result or permit late device callbacks', () => {
    const stored = globals.localStorage.getItem('trainer:3x3/pll');
    state().startTimer(1000);
    release();
    state().stopTimer(2000);
    state().startTimer(2500);
    expect(state().timerState).toBe(TimerState.NOT_RUNNING);
    expect(state().solves).toEqual([]);
    expect(globals.localStorage.getItem('trainer:3x3/pll')).toBe(stored);
  });

  it('cancels auto-next while retaining the recorded solve and local round on re-entry', async () => {
    const currentKey = state().currentKey;
    const history = state().hist;
    state().startTimer(1000);
    state().stopTimer(2000);
    release();
    release = state().activateSessionScope();
    await vi.advanceTimersByTimeAsync(1);
    expect(state().currentKey).toBe(currentKey);
    expect(state().hist).toEqual(history);
    expect(state().selected).toEqual(keys);
    expect(state().solves).toHaveLength(1);
    expect(state().solves[0].ms).toBe(1000);
  });

  it('an old cleanup cannot deactivate its successor', () => {
    const oldRelease = release;
    release = state().activateSessionScope();
    state().startTimer(1000);
    oldRelease();
    expect(state().timerState).toBe(TimerState.RUNNING);
    state().stopTimer(2000);
    state().stopTimer(3000);
    expect(state().solves).toHaveLength(1);
  });

  it('retains the completed recap dialog without awarding another sweep on re-entry', () => {
    state().setSelected([keys[0]]);
    state().setMode('recap');
    state().restartRecapRound();
    state().setShowRecapRoundEnd(true);
    expect(state().claimRecapSweep()).toBe(false);
    state().nextScramble();
    expect(state().recapRoundDone).toBe(true);
    expect(state().claimRecapSweep()).toBe(true);

    const history = state().hist;
    release();
    release = state().activateSessionScope();
    expect(state().recapRoundDone).toBe(true);
    expect(state().hist).toEqual(history);
    expect(state().claimRecapSweep()).toBe(false);

    state().continueRecapRound();
    expect(state().recapRoundDone).toBe(false);
    state().nextScramble();
    expect(state().recapRoundDone).toBe(true);
    expect(state().claimRecapSweep()).toBe(true);
    expect(state().claimRecapSweep()).toBe(false);
  });

  it('changing sessions invalidates the previous ready and auto-next actions', async () => {
    state().getTimerReady(100);
    boot('oll');
    state().getTimerReady(500);
    await vi.advanceTimersByTimeAsync(100);
    expect(state().timerState).toBe(TimerState.AWAITING_READY);
    state().startTimer(1000);
    state().stopTimer(2000);
    boot('coll');
    const currentKey = state().currentKey;
    await vi.advanceTimersByTimeAsync(500);
    expect(state().currentKey).toBe(currentKey);
    expect(state().timerState).toBe(TimerState.NOT_RUNNING);
    expect(state().solves).toEqual([]);
  });

  it('does not launch a room after the surface has left', async () => {
    release();
    expect(await state().createRoom()).toEqual({ ok: false, error: 'cancelled' });
    expect(await state().joinRoom('1234')).toEqual({ ok: false, error: 'cancelled' });
    expect(api.createRoom).not.toHaveBeenCalled();
    expect(api.getRoom).not.toHaveBeenCalled();
  });
});

describe('room replies belong to their originating session', () => {
  it.each(['create-success', 'create-failure', 'join-success', 'join-failure'])('%s cannot replace a newer pending room', async scenario => {
    const old = deferred<ReturnType<typeof info>>();
    if (scenario.startsWith('create')) vi.mocked(api.createRoom).mockReturnValueOnce(old.promise);
    else vi.mocked(api.getRoom).mockReturnValueOnce(old.promise);
    const oldResult = scenario.startsWith('create') ? state().createRoom() : state().joinRoom('1234');
    release();
    release = state().activateSessionScope();
    boot('oll');
    const incoming = deferred<ReturnType<typeof info>>();
    vi.mocked(api.getRoom).mockReturnValueOnce(incoming.promise);
    const newResult = state().joinRoom('2222');
    if (scenario.endsWith('failure')) old.reject(new Error('old connection failed'));
    else old.resolve(info());
    expect(await oldResult).toEqual({ ok: false, error: 'cancelled' });
    expect(state().roomBusy).toBe(true);
    expect(state().roomError).toBeNull();
    expect(state().room).toBeNull();
    incoming.resolve(info('2222', 'oll'));
    expect(await newResult).toEqual({ ok: true });
    await flush();
    expect(state().room?.code).toBe('2222');
  });

  it.each(['success', 'failure'])('a stale claim %s and finally cannot affect a new join to the same code', async outcome => {
    const old = deferred<ClaimBatchResult>();
    const incoming = deferred<ClaimBatchResult>();
    vi.mocked(api.claimRoomBatch).mockReturnValueOnce(old.promise).mockReturnValueOnce(incoming.promise);
    await state().joinRoom('1234');
    state().leaveRoom();
    await state().joinRoom('1234');
    if (outcome === 'success') old.resolve(batch(4));
    else old.reject(new Error('old claim failed'));
    await flush();
    expect(state().roomBusy).toBe(true);
    expect(state().currentKey).toBeNull();
    expect(state().roomClaimed).toBe(0);
    expect(state().roomError).toBeNull();
    incoming.resolve(batch());
    await flush();
    expect(state().currentKey).toBe(keys[0]);
    expect(state().roomBusy).toBe(false);
  });

  it('does not retry a transient claim after leaving its room', async () => {
    vi.mocked(api.claimRoomBatch).mockRejectedValueOnce(new Error('429 rate limit'));
    await state().joinRoom('1234');
    await flush();
    state().leaveRoom();
    await vi.advanceTimersByTimeAsync(2000);
    expect(api.claimRoomBatch).toHaveBeenCalledTimes(1);
    expect(state().roomError).toBeNull();
  });

  it.each(['success', 'failure'])('an old next-round %s cannot advance a new room', async outcome => {
    await state().joinRoom('1234');
    await flush();
    const old = deferred<{ round: number; total: number }>();
    vi.mocked(api.nextRoundRoom).mockReturnValueOnce(old.promise);
    state().continueRecapRound();
    state().leaveRoom();
    const incoming = deferred<ClaimBatchResult>();
    vi.mocked(api.claimRoomBatch).mockReturnValueOnce(incoming.promise);
    await state().joinRoom('1234');
    if (outcome === 'success') old.resolve({ round: 2, total: cases.length });
    else old.reject(new Error('old round failed'));
    await flush();
    expect(state().room?.round).toBe(1);
    expect(state().roomBusy).toBe(true);
    expect(state().roomError).toBeNull();
    expect(api.claimRoomBatch).toHaveBeenCalledTimes(2);
    incoming.resolve(batch());
    await flush();
    expect(state().currentKey).toBe(keys[0]);
  });

  it('a stale refill finally does not unlock a newer refill', async () => {
    const oldRefill = deferred<ClaimBatchResult>();
    const newRefill = deferred<ClaimBatchResult>();
    vi.mocked(api.claimRoomBatch)
      .mockResolvedValueOnce(batch())
      .mockReturnValueOnce(oldRefill.promise)
      .mockResolvedValueOnce(batch(2))
      .mockReturnValueOnce(newRefill.promise);
    await state().joinRoom('1234');
    await flush();
    state().nextScramble();
    state().leaveRoom();
    await state().joinRoom('1234');
    await flush();
    state().nextScramble();
    oldRefill.resolve(batch());
    await flush();
    state().setMultiScramble(true);
    expect(api.claimRoomBatch).toHaveBeenCalledTimes(4);
    expect(state().currentKey).toBe(keys[3]);
    newRefill.resolve(batch(4));
    await flush();
    expect(state().peek?.key).toBe(keys[4]);
  });
});

describe('async scramble ownership', () => {
  it.each(['success', 'failure'])('a prior virtual resolver %s cannot patch the new session with the same case object', async outcome => {
    const virtualCase = { ...cases[0], setup: '' };
    const old = deferred<{ setup: string; alg: string } | null>();
    const incoming = deferred<{ setup: string; alg: string } | null>();
    state().loadSession('3x3', 'virtual-old', [virtualCase], { defaultAll: true, caseResolver: () => old.promise });
    state().loadSession('3x3', 'virtual-new', [virtualCase], { defaultAll: true, caseResolver: () => incoming.promise });
    incoming.resolve({ setup: 'F', alg: "F'" });
    await flush();
    const current = state().currentScramble;
    if (outcome === 'success') old.resolve({ setup: 'R', alg: "R'" });
    else old.reject(new Error('old solver failed'));
    await flush();
    expect(virtualCase.setup).toBe('F');
    expect(state().currentScramble).toBe(current);
    expect(state().caseResolveErrors).toEqual({});
  });

  it('a cstimer result cannot patch a surface after its cleanup', async () => {
    const pending = deferred<string | null>();
    vi.mocked(cstimerStyleScramble).mockReturnValueOnce(pending.promise);
    state().setScrambleKind('cstimer');
    const before = state().currentScramble;
    release();
    pending.resolve('F2');
    await flush();
    expect(state().currentScramble).toBe(before);
  });
});
