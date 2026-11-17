import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { TimerLiveRelay, type TimerLiveAuthorize } from '../src/timer_live_relay.js';
import { applyTimerLivePatch, diffTimerLiveSnapshot, parseTimerLiveSnapshot, timerLiveCompletedAttempt,
  timerLiveHistory, timerLiveWatchUrl, parseTimerLiveWatchHash, type TimerLiveSnapshot } from '@cuberoot/shared/timer/live-share';

const id = 's'.repeat(22), hostToken = 'h'.repeat(43), viewerToken = 'v'.repeat(43);
function state(): TimerLiveSnapshot {
  return { state: { context: 'group', sessionName: 'Lesson', event: '333', scramble: 'R', phase: 'running',
    elapsedMs: 10, inspectionMs: 0, inspectionSec: 15, sampledAt: Date.now(), lastPenalty: null, trainingObservation: false, timingEnabled: true, hideTime: false, precision: 3, runningPrecision: 3 },
  cube: { connected: true, facelets: null, quaternion: null, moves: [], algAnchored: false }, attempt: null,
  history: [{ id: 'solve', event: '333', timeMs: 1000, ts: 100, penalty: 'ok', scramble: 'R' }] };
}
const auth: TimerLiveAuthorize = async (room, token, role) => room === id && token === (role === 'host' ? hostToken : viewerToken)
  ? { expiresAt: Date.now() + 60_000 } : null;
async function join(relay: TimerLiveRelay, role: 'host' | 'viewer', token = role === 'host' ? hostToken : viewerToken) {
  const socket = { bufferedAmount: 0, send: vi.fn(), close: vi.fn() };
  const c = relay.connect(socket, role);
  const send = (m: unknown) => c.handleMessage(JSON.stringify(m));
  send({ type: 'hello', version: 1, id, role, token }); await Promise.resolve();
  return { socket, send, close: c.handleClose, messages: () => socket.send.mock.calls.map(([s]) => JSON.parse(s)) };
}
describe('timer live sharing', () => {
  it('relays read-only controls and scramble progress immediately, including corrections and completion', () => {
    const original = state();
    const hint = { done: ['R'], current: 'U', pending: ['F2'], corrections: ["L'"], complete: false,
      displayMoves: [{ id: 1, move: 'R', token: 'R', state: 'done' }, { id: 2, move: "L'", token: "L'", state: 'correction' }] };
    const next = parseTimerLiveSnapshot({ ...original, state: { ...original.state,
      controls: { contentId: 'solve', source: 'wca', secret: 'private' },
      guidance: { hint, correctionActive: true, match: false, secret: 'private' } } })!;
    expect(next.state.controls).toEqual({ contentId: 'solve', source: 'wca' });
    expect(next.state.guidance).toEqual({ hint, correctionActive: true, match: false });
    expect(applyTimerLivePatch(original, diffTimerLiveSnapshot(original, next))?.state.guidance).toEqual(next.state.guidance);
    const complete = { ...next, state: { ...next.state, guidance: { hint: null, correctionActive: false, match: true } } };
    expect(applyTimerLivePatch(next, diffTimerLiveSnapshot(next, complete))?.state.guidance?.match).toBe(true);
    expect(parseTimerLiveSnapshot({ ...original, state: { ...original.state,
      guidance: { hint: { ...hint, pending: Array(1001).fill('R') }, correctionActive: false, match: false } } })?.state.guidance).toBeUndefined();
  });
  it('syncs bounded presentation settings through snapshots and deltas without private settings', () => {
    const original = state();
    const appearance = { timerFont: 'sans', timerFontScale: 1.2, scrambleFont: 'mono', scrambleFontScale: 0.8,
      soloLayout: { scrambleGap: 24, sourceGap: 12, timerGap: 28, cubeGap: 16, sourceScale: 1, cubeScale: 1.2 } };
    const next = parseTimerLiveSnapshot({ ...original, state: { ...original.state,
      appearance: { ...appearance, privateNote: 'do not share' } } })!;
    expect(next.state.appearance).toEqual(appearance);
    expect(applyTimerLivePatch(original, diffTimerLiveSnapshot(original, next))?.state.appearance).toEqual(appearance);
    const bounded = parseTimerLiveSnapshot({ ...original, state: { ...original.state,
      appearance: { timerFont: 'invalid', timerFontScale: 100, soloLayout: { timerGap: -10 } } } })!;
    expect(bounded.state.appearance?.timerFont).toBe('lcd');
    expect(bounded.state.appearance?.timerFontScale).toBe(2);
    expect(bounded.state.appearance?.soloLayout.timerGap).toBe(0);
    expect(parseTimerLiveSnapshot(original)?.state.appearance).toBeUndefined();
  });
  it('round-trips short links with a one-way room ID and preserves legacy links', async () => {
    const token = 'AQIDBAUGBwgJCgsMDQ4PEA';
    const expectedId = createHash('sha256').update(`timer-live:${token}`).digest().subarray(0, 16).toString('base64url');
    const session = { id: expectedId, token: hostToken, viewerToken: token, expiresAt: Date.now() + 60_000 };
    const url = new URL(timerLiveWatchUrl('https://cuberoot.me/zh/timer/watch', session));
    expect(url.hash).toBe(`#${token}`);
    expect(url.toString()).toHaveLength(57);
    expect(await parseTimerLiveWatchHash(url.hash)).toEqual({ id: expectedId, token });
    expect(expectedId).not.toBe(token);
    const legacy = new URL(timerLiveWatchUrl(url.origin + url.pathname, { ...session, id, viewerToken }));
    expect(await parseTimerLiveWatchHash(legacy.hash)).toEqual({ id, token: viewerToken });
    for (const invalid of ['', '#abc', `#${token}.`, `#${id}.${viewerToken}.`, `#${token.slice(0, -1)}B`]) {
      expect(await parseTimerLiveWatchHash(invalid)).toBeNull();
    }
  });
  it('accepts short viewing credentials, rejects them for hosting and revokes them', async () => {
    const token = 'AQIDBAUGBwgJCgsMDQ4PEA';
    const authorize = vi.fn<TimerLiveAuthorize>(async (_id, value, role) => value === token && role === 'viewer'
      ? { expiresAt: Date.now() + 60_000 } : null);
    const relay = new TimerLiveRelay(authorize);
    const viewer = await join(relay, 'viewer', token);
    expect(viewer.messages()[0].type).toBe('ready');
    const host = await join(relay, 'host', token);
    expect(host.socket.close).toHaveBeenCalledWith(1008, 'invalid hello');
    expect(authorize).toHaveBeenCalledTimes(1);
    relay.revoke(id);
    expect(viewer.socket.close).toHaveBeenCalledWith(4001, 'share ended');
  });
  it('replays the latest snapshot, orders patches and prevents viewer writes', async () => {
    const relay = new TimerLiveRelay(auth), host = await join(relay, 'host');
    host.send({ type: 'snapshot', snapshot: state() });
    const teacher = await join(relay, 'viewer');
    expect(teacher.messages()).toContainEqual(expect.objectContaining({ type: 'snapshot', revision: 1 }));
    host.send({ type: 'patch', base: 0, patch: { cube: { ...state().cube, connected: false } } });
    expect(host.messages().at(-1).type).toBe('resync');
    host.send({ type: 'patch', base: 1, patch: { cube: { ...state().cube, connected: false } } });
    expect(teacher.messages().at(-1)).toMatchObject({ type: 'patch', revision: 2, patch: { cube: { connected: false } } });
    teacher.send({ type: 'snapshot', snapshot: state() });
    expect(teacher.socket.close).toHaveBeenCalledWith(1008, 'viewer is read only');
    host.close(); teacher.close();
  });
  it('rejects viewer credentials for publishing and revokes an in-flight authorization', async () => {
    const relay = new TimerLiveRelay(auth), bad = await join(relay, 'host', viewerToken);
    expect(bad.socket.close).toHaveBeenCalledWith(4001, 'share ended');
    let resolve!: (value: { expiresAt: number }) => void;
    const deferred = new TimerLiveRelay(() => new Promise(r => { resolve = r; }));
    const pending = await join(deferred, 'viewer');
    deferred.revoke(id); resolve({ expiresAt: Date.now() + 60_000 }); await Promise.resolve();
    expect(pending.socket.close).toHaveBeenCalledWith(4001, 'share ended');
    expect(pending.messages()).toEqual([]);
  });
  it('marks host loss offline, allows reconnect and invalidates every peer on revoke', async () => {
    const relay = new TimerLiveRelay(auth), host = await join(relay, 'host'), teacher = await join(relay, 'viewer');
    host.send({ type: 'snapshot', snapshot: state() }); host.close();
    expect(teacher.messages().at(-1)).toMatchObject({ type: 'status', online: false });
    const resumed = await join(relay, 'host');
    resumed.send({ type: 'snapshot', snapshot: state() });
    expect(teacher.messages().at(-1)).toMatchObject({ type: 'snapshot', revision: 2 });
    relay.revoke(id);
    expect(teacher.socket.close).toHaveBeenCalledWith(4001, 'share ended');
    expect(resumed.socket.close).toHaveBeenCalledWith(4001, 'share ended');
    const late = await join(relay, 'viewer');
    expect(late.socket.close).toHaveBeenCalledWith(4001, 'share ended');
  });
  it('whitelists patch contents and treats a stale detail context as harmless', async () => {
    const relay = new TimerLiveRelay(auth), host = await join(relay, 'host'), teacher = await join(relay, 'viewer');
    host.send({ type: 'snapshot', snapshot: state() });
    host.send({ type: 'patch', base: 1, patch: { history: [{ ...state().history[0], comment: 'private note' }] } });
    expect(JSON.stringify(teacher.messages())).not.toContain('private note');
    teacher.send({ type: 'detail', solveId: 'gone', context: 'old-group', requestId: 'request' });
    expect(teacher.socket.close).not.toHaveBeenCalled();
    host.close(); teacher.close();
  });
  it('preserves history and attempt references for pose-only updates', () => {
    const previous = parseTimerLiveSnapshot(state())!;
    const next = applyTimerLivePatch(previous, { cube: { ...previous.cube, connected: false } })!;
    expect(next.history).toBe(previous.history); expect(next.attempt).toBe(previous.attempt);
    expect(next.state).toBe(previous.state);
    expect(applyTimerLivePatch(previous, { attempt: { solve: previous.history[0], moveFrom: 5, moves: [], gyroFrom: 0, gyro: [] } })).toBeNull();
  });
  it('expires existing viewers without depending on new HTTP requests', async () => {
    const relay = new TimerLiveRelay(auth), host = await join(relay, 'host'), teacher = await join(relay, 'viewer');
    relay.sweep(Date.now() + 61_000);
    expect(host.socket.close).toHaveBeenCalledWith(4001, 'share ended');
    expect(teacher.socket.close).toHaveBeenCalledWith(4001, 'share ended');
  });
  it('carries final canonical moves after stopping and bounds shared history', () => {
    const base = state();
    const final = { ...base.history[0], moves: [{ m: "R'", ts: 1000 }] };
    const complete = timerLiveCompletedAttempt({ context: 'group', solve: final }, 'group', '333')!;
    const next = { ...base, attempt: complete, state: { ...base.state, phase: 'stopped' as const } };
    const patch = diffTimerLiveSnapshot(base, next);
    expect(applyTimerLivePatch(base, patch)?.attempt?.solve.moves).toEqual(final.moves);
    const history = timerLiveHistory(Array.from({ length: 201 }, (_, i) => ({ ...final, id: String(i), ts: i })));
    expect(history).toHaveLength(200); expect(history[0].id).toBe('1');
    expect(history[0].moves).toBeUndefined();
    expect(timerLiveCompletedAttempt({ context: 'group', solve: final }, 'group', '222')).toBeNull();
    expect(timerLiveCompletedAttempt({ context: 'group', solve: final }, 'another-group', '333')).toBeNull();
  });
});
