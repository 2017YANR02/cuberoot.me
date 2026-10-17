import { afterEach, expect, it, vi } from 'vitest';
import { createGanV4Cipher } from '@cuberoot/shared/smart-cube/gan-v4';
import { createWatchCubeBridge } from './watch-cube';
import { GAN_V4_FIXTURE } from './smart-cube/gan-v4.fixture';
import { decodeGyroTrack } from '@cuberoot/shared/smart-cube/gyro-track';

afterEach(() => vi.useRealTimers());
it('retains a long pending GAN burst until history arrives instead of saving a two-move solve', async () => {
  vi.useFakeTimers();
  const bridge = createWatchCubeBridge();
  const events: Record<string, any>[] = [];
  async function feed(message: Record<string, unknown>) {
    bridge.dispatch(message);
    for (let i = 0; i < 40; i++) {
      await Promise.resolve();
      for (const event of JSON.parse(bridge.drain())) {
        if (event.kind === 'native') bridge.dispatch({ kind: 'reply', id: event.id });
        else events.push(event);
      }
    }
  }
  const cipher = createGanV4Cipher(Uint8Array.of(0xab, 0xcd, 0xef, 1, 0x23, 0x45));
  const frame = (bytes: readonly number[], now: number) => feed({ kind: 'notification', now, bytes: [...cipher.encrypt(Uint8Array.from(bytes))] });
  await feed({ kind: 'context', id: 'burst', event: '333', scramble: 'R', enabled: true, now: 100000 });
  await feed({ kind: 'connect', device: { id: 'AB:CD:EF:01:23:45', name: 'GAN16ui' } });
  await frame(GAN_V4_FIXTURE.seed, 100000);
  const solveMoves = ["U'", 'R', 'U', ...Array.from({ length: 8 }, () => ['R', "R'"]).flat(), "U'", "R'", 'U', "R'"];
  // Scramble + two solve turns arrive. One missing turn blocks the following
  // twenty notifications, including the actual final turn.
  for (let counter = 41; counter <= 64; counter++) {
    if (counter === 44) continue;
    const move = Uint8Array.from(GAN_V4_FIXTURE.moves[0]);
    move[6] = counter;
    const notation = counter === 41 ? 'R' : solveMoves[counter - 42];
    move[8] = (notation[0] === 'R' ? 32 : 2) + (notation.endsWith("'") ? 64 : 0);
    new DataView(move.buffer).setUint32(2, 1000 + (counter - 41) * 100, true);
    await frame([...move], 100000 + (counter - 41) * 100);
  }
  const snapshot = [...GAN_V4_FIXTURE.solved] as number[];
  snapshot[2] = 64;
  await frame(snapshot, 103000);
  expect(events.filter(event => event.kind === 'timer' && event.solve)).toEqual([]);
  // The existing GAN history path supplies the missing physical U, after
  // which every buffered turn must be recorded before the solved edge.
  const history = [...GAN_V4_FIXTURE.history] as number[];
  history[3] = 0xa2; history[4] = 0xa3;
  await frame(history, 123100); // long recovery may complete an already-running attempt
  const solves = events.filter(event => event.kind === 'timer' && event.solve);
  expect(solves).toHaveLength(1);
  expect(solves[0].recording.moves).toEqual(solveMoves.map((m, i) => ({ m, ts: i * 100 })));
  expect(solves[0].solve).toEqual({ timeMs: 2200, inspectionMs: 0, autoPenalty: 'ok' });
});

it.each([800, 20000])('handles a missing first solve turn arriving after %i ms without a ghost timer', async delay => {
  vi.useFakeTimers();
  const bridge = createWatchCubeBridge(), events: Record<string, any>[] = [];
  async function feed(message: Record<string, unknown>) {
    bridge.dispatch(message);
    for (let i = 0; i < 40; i++) {
      await Promise.resolve();
      for (const event of JSON.parse(bridge.drain())) {
        if (event.kind === 'native') bridge.dispatch({ kind: 'reply', id: event.id });
        else events.push(event);
      }
    }
  }
  const cipher = createGanV4Cipher(Uint8Array.of(0xab, 0xcd, 0xef, 1, 0x23, 0x45));
  const frame = (bytes: readonly number[], now: number) => feed({ kind: 'notification', now, bytes: [...cipher.encrypt(Uint8Array.from(bytes))] });
  await feed({ kind: 'context', id: 'missing-first', event: '333', scramble: 'R', enabled: true, now: 100000 });
  await feed({ kind: 'connect', device: { id: 'AB:CD:EF:01:23:45', name: 'GAN16ui' } });
  await frame(GAN_V4_FIXTURE.seed, 100000);
  await frame(GAN_V4_FIXTURE.moves[0], 100000); // live scramble arms
  await frame(GAN_V4_FIXTURE.moves[2], 100500);
  await frame(GAN_V4_FIXTURE.moves[3], 100750);
  await frame(GAN_V4_FIXTURE.history, 100000 + delay);
  const timers = events.filter(event => event.kind === 'timer');
  if (delay === 800) {
    expect(timers.at(-1)?.phase).toBe('stopped');
    expect(timers.at(-1)?.solve.timeMs).toBe(500);
    expect(timers.at(-1)?.recording.moves).toEqual([{ m: 'R', ts: 0 }, { m: 'R', ts: 250 }, { m: 'R', ts: 500 }]);
  } else {
    expect(timers.at(-1)?.phase).toBe('idle');
    expect(timers.some(event => event.phase === 'running' || event.solve)).toBe(false);
    expect(events.filter(event => event.kind === 'timing-late')).toHaveLength(1);
    // A later live move cannot use the cancelled preparation to start late.
    const next = [...GAN_V4_FIXTURE.moves[0]] as number[];
    next[6] = 45; next[8] = 2; // U, not the R scramble target
    await frame(next, 121000);
    expect(events.some(event => event.kind === 'timer' && event.phase === 'running')).toBe(false);
  }
  // History cannot arm itself by replaying the scramble completion edge.
  await feed({ kind: 'context', id: 'all-history', event: '333', scramble: 'R', enabled: true });
  await feed({ kind: 'disconnected' });
  await feed({ kind: 'connect', device: { id: 'AB:CD:EF:01:23:45', name: 'GAN16ui' } });
  await frame(GAN_V4_FIXTURE.seed, 130000);
  await frame(GAN_V4_FIXTURE.moves[3], 130750);
  await frame(GAN_V4_FIXTURE.history, 150000);
  expect(events.some(event => event.kind === 'timer' && event.contextId === 'all-history' && event.phase === 'running')).toBe(false);
});

it('reuses GAN frames, clock and timer with host storage lock and disconnect handling', async () => {
  vi.useFakeTimers();
  const bridge = createWatchCubeBridge();
  const events: Record<string, any>[] = [];
  async function feed(message: Record<string, unknown>) {
    bridge.dispatch(message);
    for (let i = 0; i < 40; i++) {
      await Promise.resolve();
      for (const event of JSON.parse(bridge.drain())) {
        if (event.kind === 'native') bridge.dispatch({ kind: 'reply', id: event.id });
        else events.push(event);
      }
    }
  }
  const cipher = createGanV4Cipher(Uint8Array.of(0xab, 0xcd, 0xef, 1, 0x23, 0x45));
  const frame = (bytes: readonly number[], now: number) => feed({ kind: 'notification', now, bytes: [...cipher.encrypt(Uint8Array.from(bytes))] });
  await feed({ kind: 'context', id: 'auto', event: '333', scramble: 'R', enabled: true, now: 100000 });
  await feed({ kind: 'connect', device: {
    id: '93F18F53-A6E8-4A6A-91B4-836AB85BC247', name: 'GAN16ui',
    // Apple removes the company header; this 20-byte payload is a 22-byte broadcast.
    // The canonical address window precedes firmware extension bytes.
    manufacturerData: [[1, [0,0,0,0x45,0x23,1,0xef,0xcd,0xab,1,2,3,4,5,6,7,8,9,10,11]]],
  } });
  await frame(GAN_V4_FIXTURE.seed, 100000);
  await frame(GAN_V4_FIXTURE.gyro, 100000);
  await feed({ kind: 'tap', now: 100000 }); // connected idle cannot start by touch
  for (const [i, move] of GAN_V4_FIXTURE.moves.entries()) {
    await frame(move, 100000 + i * 250);
    await feed({ kind: 'tap', now: 100000 + i * 250 }); // neither ready nor running can start/stop by touch
  }
  await frame(GAN_V4_FIXTURE.moves[3], 100800);
  await feed({ kind: 'context', id: 'disabled', event: '333', scramble: 'R', enabled: false });
  await frame(GAN_V4_FIXTURE.solved, 101000);
  await feed({ kind: 'tap', now: 101000 });
  await feed({ kind: 'context', id: 'disconnect', event: '333', scramble: 'R', enabled: true });
  for (let i = 0; i < 2; i++) {
    const turn = Uint8Array.from(GAN_V4_FIXTURE.moves[i]);
    turn[6] = 45 + i;
    new DataView(turn.buffer).setUint32(2, 2750 + i * 250, true);
    await frame([...turn], 101750 + i * 250);
  }
  await feed({ kind: 'reset', now: 102000 }); // running rejects calibration
  await feed({ kind: 'disconnected', now: 102500 });
  await feed({ kind: 'context', id: 'manual', event: '333', scramble: 'R', enabled: true, inspectionSec: 15 });
  await feed({ kind: 'tap', now: 103000 });
  await feed({ kind: 'tap', now: 119000 });
  await feed({ kind: 'tap', now: 119500 });
  expect(events.some(event => event.kind === 'connection' && event.phase === 'connected')).toBe(true);
  expect(events.filter(event => event.kind === 'move').map(event => event.move)).toEqual(['R','R','R','R','R','R']);
  expect(events.filter(event => event.kind === 'timer' && event.phase === 'ready')).toHaveLength(2);
  expect(events.filter(event => event.kind === 'reset' && event.phase === 'pending')).toEqual([]);
  expect(events.filter(event => event.kind === 'timer' && event.contextId === 'disabled')).toEqual([]);
  expect(events.filter(event => event.kind === 'timer' && event.solve).map(event => [event.contextId, event.solve])).toEqual([
    ['auto', { timeMs: 500, inspectionMs: 0, autoPenalty: 'ok' }],
    ['disconnect', { timeMs: 500, inspectionMs: 0, autoPenalty: 'DNF' }],
    ['manual', { timeMs: 500, inspectionMs: 16000, autoPenalty: '+2' }],
  ]);
  const recorded = events.find(event => event.kind === 'timer' && event.contextId === 'auto' && event.solve)!.recording;
  expect(recorded.moves).toEqual([{ m: 'R', ts: 0 }, { m: 'R', ts: 250 }, { m: 'R', ts: 500 }]);
  expect(recorded.device.model).toBe('gan-v4');
  expect(decodeGyroTrack(recorded.gyro)[0].frame).toBe('scramble');
  expect(events.find(event => event.kind === 'timer' && event.contextId === 'manual' && event.solve)!.recording.moves).toEqual([]);
});

it('calibrates through the iOS GAN reset and blocks timing until device confirmation', async () => {
  vi.useFakeTimers();
  const bridge = createWatchCubeBridge();
  const events: Record<string, any>[] = [], writes: number[] = [];
  const cipher = createGanV4Cipher(Uint8Array.of(0xab, 0xcd, 0xef, 1, 0x23, 0x45));
  async function feed(message: Record<string, unknown>) {
    bridge.dispatch(message);
    for (let i = 0; i < 40; i++) {
      await Promise.resolve();
      for (const event of JSON.parse(bridge.drain())) {
        if (event.kind === 'native') {
          if (event.op === 'write') writes.push(cipher.decrypt(Uint8Array.from(event.bytes))[0]);
          bridge.dispatch({ kind: 'reply', id: event.id });
        } else events.push(event);
      }
    }
  }
  const frame = (bytes: readonly number[]) => feed({ kind: 'notification', bytes: [...cipher.encrypt(Uint8Array.from(bytes))] });
  await feed({ kind: 'context', id: 'reset', event: '333', scramble: 'R', enabled: true, now: 10000 });
  await feed({ kind: 'connect', device: { id: 'AB:CD:EF:01:23:45', name: 'GAN16ui' } });
  await frame(GAN_V4_FIXTURE.seed);
  events.length = 0; writes.length = 0;
  await feed({ kind: 'reset' });
  await feed({ kind: 'reset' }); // no second command while calibrating
  await feed({ kind: 'tap' });
  expect(writes.filter(command => command === 0xd2)).toHaveLength(1);
  expect(events.filter(event => event.kind === 'reset').map(event => event.phase)).toEqual(['pending']);
  for (const move of GAN_V4_FIXTURE.moves) await frame(move);
  expect(events.filter(event => event.kind === 'move' || (event.kind === 'timer' && event.solve))).toEqual([]);
  bridge.dispatch({ kind: 'notification', bytes: [...cipher.encrypt(Uint8Array.from(GAN_V4_FIXTURE.solved))] });
  const duringConfirmation = Uint8Array.from(GAN_V4_FIXTURE.moves[0]);
  duringConfirmation[6] = 45;
  bridge.dispatch({ kind: 'notification', bytes: [...cipher.encrypt(duringConfirmation)] });
  await feed({ kind: 'clock' });
  expect(events.filter(event => event.kind === 'reset').map(event => event.phase)).toEqual(['pending', 'success']);
  expect(events.filter(event => event.kind === 'state').at(-1)?.solved).toBe(false);
  expect(events.filter(event => event.kind === 'snapshot').at(-1)?.facelets)
    .toBe(events.filter(event => event.kind === 'state').at(-1)?.facelets);
  expect(events.filter(event => event.kind === 'timer').map(event => event.phase)).toEqual(['idle']);
  expect(events.filter(event => event.kind === 'gyro-reset')).toHaveLength(1);
  await feed({ kind: 'tap', now: 11000 });
  await feed({ kind: 'reset' });
  await frame(GAN_V4_FIXTURE.moves[0]); // reset cleared protocol counter; unconfirmed turn
  await vi.advanceTimersByTimeAsync(4000);
  await feed({ kind: 'clock', now: 16000 });
  expect(events.filter(event => event.kind === 'reset').at(-1)?.phase).toBe('failed');
  expect(events.filter(event => event.kind === 'snapshot').at(-1)?.facelets)
    .toBe(events.filter(event => event.kind === 'state').at(-1)?.facelets);
  expect(events.filter(event => event.kind === 'timer' && event.solve)).toEqual([]);
  await feed({ kind: 'reset' });
  await feed({ kind: 'disconnected' });
  expect(events.filter(event => event.kind === 'reset').at(-1)?.phase).toBe('idle');
});

it('renders the offline scramble using the canonical 2D unfolded layout and colors', async () => {
  const { renderUnfoldedSvg } = await import('@cuberoot/shared/cube-unfolded-svg');
  const { smartCubeTargetFacelets } = await import('@cuberoot/shared/smart-cube/cubie');
  const scramble = "R U F2 L' D B2";
  const svg = renderUnfoldedSvg(3, scramble);
  const bridge = createWatchCubeBridge();
  const preview = JSON.parse(bridge.scramblePreview(smartCubeTargetFacelets(scramble)!));
  const expected = [...svg.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="1" height="1" fill="(#[0-9A-Fa-f]+)"/g)]
    .map(match => {
      const rgb = parseInt(match[3].slice(1), 16);
      return { x: Number(match[1]), y: Number(match[2]), color: [((rgb >> 16) & 255) / 255, ((rgb >> 8) & 255) / 255, (rgb & 255) / 255] };
    });
  const sort = (a: { x: number; y: number }, b: { x: number; y: number }) => a.y - b.y || a.x - b.x;
  expect(preview.cells).toHaveLength(54);
  expect(preview.cells.sort(sort)).toEqual(expected.sort(sort));
  expect([preview.width, preview.height, preview.stroke]).toEqual([13, 9.8, 0.1]);
});

it('publishes scramble steps for Watch coloring and clears them on disconnect', async () => {
  vi.useFakeTimers();
  const bridge = createWatchCubeBridge(), events: Record<string, any>[] = [];
  async function feed(message: Record<string, unknown>) {
    bridge.dispatch(message);
    for (let i = 0; i < 40; i++) {
      await Promise.resolve();
      for (const event of JSON.parse(bridge.drain())) {
        if (event.kind === 'native') bridge.dispatch({ kind: 'reply', id: event.id });
        else events.push(event);
      }
    }
  }
  const cipher = createGanV4Cipher(Uint8Array.of(0xab, 0xcd, 0xef, 1, 0x23, 0x45));
  const frame = (bytes: readonly number[], now: number) => feed({ kind: 'notification', now, bytes: [...cipher.encrypt(Uint8Array.from(bytes))] });
  const guidance = () => events.filter(e => e.kind === 'guidance').at(-1);
  await feed({ kind: 'context', id: 'colored', event: '333', scramble: 'R U', enabled: true, now: 100000 });
  await feed({ kind: 'connect', device: { id: 'AB:CD:EF:01:23:45', name: 'GAN16ui' } });
  await frame(GAN_V4_FIXTURE.seed, 100000);
  expect(guidance()).toMatchObject({ contextId: 'colored', hint: { done: [], current: 'R', pending: ['U'] } });
  await frame(GAN_V4_FIXTURE.moves[0], 100000);
  expect(guidance()).toMatchObject({ hint: { done: ['R'], current: 'U', pending: [] } });
  const move = Uint8Array.from(GAN_V4_FIXTURE.moves[0]);
  move[6] = 42; move[8] = 2;
  new DataView(move.buffer).setUint32(2, 1250, true);
  await frame([...move], 100250);
  expect(guidance()).toMatchObject({ contextId: 'colored', matched: true, hint: null });
  await feed({ kind: 'disconnect' });
  expect(guidance()).toMatchObject({ matched: null, hint: null });
});
