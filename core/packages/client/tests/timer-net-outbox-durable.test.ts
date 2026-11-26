// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeNetOutboxEntry, NetRecordingOutbox, uploadNetRecordedAttempt, upsertNetRecordedSolve, type NetRecordedAttempt, type NetBattleClient, type NetRoomState, type Solve } from '@cuberoot/shared/timer';
import { createNetOutboxStorage } from '@cuberoot/timer-ui';

const record = (id = 'net-1234-abcdef-1'): NetRecordedAttempt => ({
  context: { id, code: '1234', playerId: 'abcdef', round: 1, sessionId: 'original', ts: 100, event: '333', scramble: 'R' },
  solve: { id, ts: 100, timeMs: 1000, penalty: 'ok', event: '333', scramble: 'R', moves: [{ m: "R'", ts: 0 }] },
});
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const session = { code: '1234', playerId: 'abcdef', playerToken: 'x'.repeat(48), name: 'Cuber' };
function room(): NetRoomState { return { code: '1234', revision: 1, round: 1, videoGeneration: 'x', roundRoster: [], event: '333', scrambles: { '333': 'R' },
  players: { abcdef: { name: 'Cuber', event: '333', joined: 1, seen: 1, ph: 'idle', at: 0 } }, results: {}, history: [], scores: {}, admin: 'abcdef', syncStart: false, startAt: null, now: 100 }; }

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => { const request = indexedDB.deleteDatabase('cuberoot-net-outbox-v1'); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
  let tail = Promise.resolve<unknown>(undefined);
  Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name: string, work: () => Promise<unknown>) => {
    const next = tail.then(work); tail = next.catch(() => undefined); return next;
  } } });
});
afterEach(() => vi.restoreAllMocks());

describe('durable online result delivery', () => {
  it('recovers both local save and upload across a fresh instance without persisting credentials', async () => {
    const storage = createNetOutboxStorage();
    const first = new NetRecordingOutbox(async () => { throw Error('disk full'); }, storage);
    first.setUploader(async () => { throw Error('offline'); });
    await first.enqueue(record(), true);
    expect(first.result(record().context)).toEqual({ t: 1000, p: 'ok' });
    expect(first.result({ ...record().context, round: 2 })).toBeUndefined();
    expect(JSON.stringify(await storage.load())).not.toContain('playerToken');
    const save = vi.fn(), upload = vi.fn(async (_record: NetRecordedAttempt) => 'uploaded' as const);
    const recovered = new NetRecordingOutbox(save, createNetOutboxStorage()); recovered.setUploader(upload);
    await recovered.retry();
    expect(save).toHaveBeenCalledWith(record()); expect(upload).toHaveBeenCalledWith(record());
    expect(recovered.result(record().context)).toEqual({ t: 1000, p: 'ok' });
    expect(await storage.load()).toEqual([]);
  });
  it('journals new attempts and a newer penalty while another window is blocked uploading', async () => {
    const storage = createNetOutboxStorage(), blocked = deferred<'uploaded'>(), started = deferred<void>();
    const first = new NetRecordingOutbox(vi.fn(), storage);
    first.setUploader(async () => { started.resolve(); return blocked.promise; });
    const running = first.enqueue(record(), true); await started.promise;
    const second = new NetRecordingOutbox(vi.fn(), createNetOutboxStorage());
    const correction = record(); correction.context.sessionId = 'different'; correction.solve.moves = undefined; correction.solve.penalty = '+2';
    const queued = second.enqueue(correction, true);
    const another = second.enqueue(record('net-1234-abcdef-2'), true);
    await vi.waitFor(async () => { expect(await storage.load()).toHaveLength(2); });
    const stored = (await storage.load()) as { record: NetRecordedAttempt }[];
    expect(stored.find(e => e.record.solve.id === correction.solve.id)?.record).toEqual({ ...record(), solve: { ...record().solve, penalty: '+2' } });
    blocked.resolve('uploaded'); await running; await Promise.all([queued, another]);
    expect((await storage.load()).length).toBe(2); // stale ACK cannot delete the durable correction
    const replay = new NetRecordingOutbox(vi.fn(), storage); const upload = vi.fn(async (_record: NetRecordedAttempt) => 'uploaded' as const); replay.setUploader(upload);
    await replay.retry(); expect(upload.mock.calls.map(([r]) => r.solve.penalty)).toEqual(['+2', 'ok']);
  });
  it('keeps entries until local storage and receipt deletion both succeed', async () => {
    const storage = createNetOutboxStorage(); let fail = true;
    const save = vi.fn();
    const first = new NetRecordingOutbox(save, { ...storage, remove: async (id, revision) => { if (fail) throw Error('receipt failure'); await storage.remove(id, revision); } });
    first.setUploader(async () => 'uploaded'); await first.enqueue(record(), true);
    expect(first.getSnapshot().pending).toBe(1); expect(await storage.load()).toHaveLength(1);
    fail = false; const replaySave = vi.fn(), replayUpload = vi.fn();
    const replay = new NetRecordingOutbox(replaySave, storage); replay.setUploader(replayUpload); await replay.retry();
    expect(replaySave).not.toHaveBeenCalled(); expect(replayUpload).not.toHaveBeenCalled(); expect(await storage.load()).toEqual([]);
  });
  it('does not upload without a durable journal or an exclusive delivery lock', async () => {
    const storage = createNetOutboxStorage(), upload = vi.fn(async () => 'uploaded' as const);
    const failed = new NetRecordingOutbox(vi.fn(), { ...storage, put: async () => { throw Error('quota'); } }); failed.setUploader(upload);
    await failed.enqueue(record(), true); expect(upload).not.toHaveBeenCalled(); expect(failed.getSnapshot().volatile).toBe(true);
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    const noLock = new NetRecordingOutbox(vi.fn(), storage); noLock.setUploader(upload); await noLock.enqueue(record(), true);
    expect(upload).not.toHaveBeenCalled(); expect(await storage.load()).toHaveLength(1);
  });
  it('retains a rejected result locally until the user acknowledges it', async () => {
    const storage = createNetOutboxStorage(), save = vi.fn(); const outbox = new NetRecordingOutbox(save, storage);
    outbox.setUploader(async () => 'rejected'); await outbox.enqueue(record(), true);
    expect(save).toHaveBeenCalledWith(record()); expect(outbox.getSnapshot().rejected).toBe(1);
    const reopened = new NetRecordingOutbox(save, storage);
    await reopened.retry();
    expect(outbox.result(record().context)).toBeUndefined();
    expect(reopened.result(record().context)).toBeUndefined();
    await outbox.acknowledgeRejected(); expect(await storage.load()).toEqual([]); expect(save).toHaveBeenCalledTimes(1);
    expect(outbox.result(record().context)).toBeUndefined();
  });
  it('uploads a fresh solve in the same round and preserves the rejected local recording', async () => {
    const storage = createNetOutboxStorage();
    let history: Solve[] = [];
    const save = ({ solve }: NetRecordedAttempt) => { history = upsertNetRecordedSolve(history, solve); };
    const first = new NetRecordingOutbox(save, storage);
    const rejected = record(); rejected.solve.timeMs = 0.4;
    first.setUploader(async () => 'rejected');
    await first.enqueue(rejected, true);
    const reopened = new NetRecordingOutbox(save, storage);
    const uploader = vi.fn(async () => 'uploaded' as const);
    reopened.setUploader(uploader);
    await reopened.retry();
    const next = record(); next.solve.ts = next.context.ts = 200;
    await reopened.enqueue(next, true);
    expect(uploader).toHaveBeenCalledExactlyOnceWith(next);
    expect(reopened.result(next.context)).toEqual({ t: 1000, p: 'ok' });
    expect(history.map(solve => solve.timeMs)).toEqual([0.4, 1000]);
    expect(new Set(history.map(solve => solve.id)).size).toBe(2);
  });
  it('submits a sub-millisecond blindfolded result using the room event id', async () => {
    const state = { ...room(), event: '333bld' as const, scrambles: { '333bld': 'R' } };
    state.players.abcdef!.event = '333bld';
    const post = vi.fn(async () => ({ ...state, results: { '1': { abcdef: { t: 0, p: 'ok' as const } } } }));
    const client = { getNetRoom: vi.fn(async () => state), postNetResult: post } as unknown as NetBattleClient;
    const attempt = record(); attempt.context.event = attempt.solve.event = '333bld'; attempt.solve.timeMs = 0.4;
    expect(await uploadNetRecordedAttempt(attempt, client, { load: async () => session })).toBe('uploaded');
    expect(post).toHaveBeenCalledExactlyOnceWith('1234', session, 1, 0, 'ok');
    const oldEntry = decodeNetOutboxEntry({ version: 1, revision: 'legacy', localSaved: false, upload: 'pending', record: {
      context: { ...attempt.context, event: '333bf' }, solve: { ...attempt.solve, event: '333bf' },
    } });
    expect(oldEntry?.record).toEqual(attempt);
  });
  it('verifies already accepted results, rejects expired rounds and never reuses another membership', async () => {
    const state = room(); const post = vi.fn(async () => ({ ...state, results: { '1': { abcdef: { t: 1000, p: 'ok' as const } } } }));
    const client = { getNetRoom: vi.fn(async () => state), postNetResult: post } as unknown as NetBattleClient;
    const sessions = { load: vi.fn(async () => session) };
    const fractional = record(); fractional.solve.timeMs = 1000.4;
    expect(await uploadNetRecordedAttempt(fractional, client, sessions)).toBe('uploaded');
    expect(post).toHaveBeenCalledWith('1234', session, 1, 1000, 'ok');
    state.results = { '1': { abcdef: { t: 1000, p: 'ok' } } };
    expect(await uploadNetRecordedAttempt(record(), client, sessions)).toBe('uploaded'); expect(post).toHaveBeenCalledTimes(1);
    state.results = {}; state.round = 2;
    expect(await uploadNetRecordedAttempt(record(), client, sessions)).toBe('rejected'); expect(post).toHaveBeenCalledTimes(1);
    expect(await uploadNetRecordedAttempt(record(), client, { load: async () => ({ ...session, playerId: 'different' }) })).toBe('rejected');
  });
});
