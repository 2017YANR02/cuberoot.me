// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyScramble, toFaceletString } from '@/app/[lang]/timer/_lib/cube/state';
import type { BluetoothCubeHandle } from '@/app/[lang]/timer/_lib/bluetooth';
import type { BattleCubes } from '@/app/[lang]/timer/_battle/useBattleCubes';

vi.mock('@/app/[lang]/timer/_battle/engine/engine_loader', () => ({
  isScrambleEngineReady: () => true, loadScrambleEngine: () => Promise.resolve(),
}));
vi.mock('@/app/[lang]/timer/_battle/engine/scramble_engine', () => ({
  generateScramble: () => 'R U', generateScrambleImageUrl: () => null,
}));
vi.mock('@/app/[lang]/timer/_lib/scramble/wca_pool', () => ({
  hasWcaSource: () => false, peekWca: () => null, nextWca: () => Promise.resolve(null),
  prefetchWca: () => {}, wcaMetaFor: () => null,
}));
vi.mock('@/app/[lang]/timer/_shared/useLiveCubeAnchor', () => ({
  useLiveCubeAnchor: () => ({ moves: [], algAnchored: true, anchor: { move() {}, observeFacelets() {} } }),
}));
vi.mock('@/app/[lang]/timer/_lib/bluetooth', () => ({ useBluetoothCube: vi.fn() }));
vi.mock('@/app/[lang]/timer/_lib/bluetooth/scramble_fixup', () => ({ fixupScramble: vi.fn(async () => null) }));
vi.mock('@/app/[lang]/timer/_lib/storage/db', () => ({
  appendSolves: vi.fn(), makeSolve: (solve: unknown) => solve,
}));

const { useBluetoothCube } = await import('@/app/[lang]/timer/_lib/bluetooth');
const { useBattleCubes } = await import('@/app/[lang]/timer/_battle/useBattleCubes');
const { useBattleStore } = await import('@/app/[lang]/timer/_battle/engine/battle_store');
const { initialTimerMachineState, decodeLocalBattleRounds } = await import('@cuberoot/shared/timer');
const { appendSolves } = await import('@/app/[lang]/timer/_lib/storage/db');
const { updateSettings } = await import('@/app/[lang]/timer/_lib/settings');
const { fixupScramble } = await import('@/app/[lang]/timer/_lib/bluetooth/scramble_fixup');
type Options = NonNullable<Parameters<typeof useBluetoothCube>[0]>;
let callbacks: Options[];
let handles: BluetoothCubeHandle[];
let root: Root;
let host: HTMLDivElement;
let cubes: BattleCubes;
function Harness({ suspended = false }: { suspended?: boolean }) {
  cubes = useBattleCubes({ suspended });
  return null;
}
function render(suspended = false) {
  act(() => root.render(createElement(Harness, { suspended })));
}
function setCube(slot: number, scramble: string, connected = true) {
  const faces = applyScramble(3, scramble);
  handles[slot] = { ...handles[slot], facelets: toFaceletString(faces), getFaces: () => faces,
    status: { ...handles[slot].status, connected } };
}
function move(slot: number, notation: string, atMs: number, state: string) {
  setCube(slot, state);
  act(() => callbacks[slot].onMove?.(notation, atMs, handles[slot].facelets!));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const store = useBattleStore.getState();
  updateSettings({ bluetoothAutoReady: 'scrambled', recordGyro: false });
  vi.mocked(appendSolves).mockClear();
  vi.mocked(fixupScramble).mockReset().mockResolvedValue(null);
  store.cancelReadyTimer();
  useBattleStore.setState({ mode: '1v1', playerCount: 2, syncStart: false, cubeMode: 'own', cubeHolder: 0,
    inspectionTime: 0, battleRounds: [], scrambles: ['R U', 'R U', 'R U', 'R U'],
    scrambleRevisions: [0, 0, 0, 0],
    puzzleIds: ['333', '333', '333', '333'], scrambleLoadings: [false, false, false, false],
    scrambleErrors: [false, false, false, false],
    players: store.players.map(player => ({ ...player, timerState: initialTimerMachineState(), recording: undefined,
      isReady: false, canStart: false, isInspecting: false, isTiming: false, hasFinished: false,
      startTime: 0, time: 0, pointerId: null, inspectionPenalty: null })),
  });
  callbacks = [];
  handles = Array.from({ length: 4 }, (_, slot) => ({ status: { connected: false, deviceName: `Cube ${slot}`,
    deviceId: `cube-${slot}`, brand: 'gan-v4', battery: 100, hasGyro: true }, facelets: null, getFaces: () => null,
  } as unknown as BluetoothCubeHandle));
  let call = 0;
  vi.mocked(useBluetoothCube).mockImplementation(options => {
    const slot = call++ % 4;
    callbacks[slot] = options!;
    return handles[slot];
  });
  host = document.createElement('div'); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); useBattleStore.getState().cancelReadyTimer(); });

it('verifies a connected snapshot after closing the panel, then times only that player', () => {
  setCube(0, 'R U');
  render(true);
  expect(useBattleStore.getState().players[0].canStart).toBe(false);
  render();
  expect(useBattleStore.getState().players[0].canStart).toBe(true);
  expect(useBattleStore.getState().players[1].canStart).toBe(false);
  move(0, "U'", 1_000, 'R');
  expect(useBattleStore.getState().players[0].isTiming).toBe(true);
  move(0, "R'", 2_000, '');
  act(() => callbacks[0].onSolved?.(2_000));
  expect(useBattleStore.getState().players[0].time).toBe(1_000);
  expect(useBattleStore.getState().players[1].hasFinished).toBe(false);
});

it('starts on the first turn during inspection and cancels inspection on disconnect', () => {
  useBattleStore.setState({ inspectionTime: 15 });
  setCube(0, 'R U'); render();
  expect(useBattleStore.getState().players[0].isInspecting).toBe(true);
  act(() => callbacks[0].onConnectionEvent?.({ kind: 'disconnected', reason: 'gatt-lost' }));
  expect(useBattleStore.getState().players[0].isInspecting).toBe(false);
  setCube(0, 'R U', false); render();
  setCube(0, 'R U'); render();
  expect(useBattleStore.getState().players[0].isInspecting).toBe(true);
  move(0, "U'", performance.now() + 500, 'R');
  expect(useBattleStore.getState().players[0].isTiming).toBe(true);
});

it('ignores removed slots and unsupported events even when their cubes still send moves', () => {
  setCube(2, 'R U'); setCube(0, 'R U');
  useBattleStore.setState({ puzzleIds: ['222', '222', '333', '333'] });
  render();
  move(2, "U'", 1_000, 'R'); move(0, "U'", 1_000, 'R');
  expect(useBattleStore.getState().players.every(player => !player.isTiming && !player.canStart)).toBe(true);
});

it('rejects assigning one physical cube to two players before connecting it', () => {
  setCube(0, ''); render();
  const device = { id: 'cube-0' } as BluetoothDevice;
  expect(() => callbacks[0].validateDevice?.(device)).not.toThrow();
  expect(() => callbacks[1].validateDevice?.(device)).toThrow();
});

it('honors gesture readiness instead of arming as soon as the scramble matches', () => {
  updateSettings({ bluetoothAutoReady: 'double-flick' });
  setCube(0, 'R U'); render();
  expect(useBattleStore.getState().players[0].canStart).toBe(false);
  move(0, 'F', 1_000, 'R U F');
  move(0, "F'", 1_100, 'R U');
  expect(useBattleStore.getState().players[0].canStart).toBe(true);
  move(0, "U'", 2_000, 'R');
  expect(useBattleStore.getState().players[0].isTiming).toBe(true);
});

it('keeps each cube’s correction and progress independent through batched moves', () => {
  setCube(0, ''); setCube(1, ''); render();
  expect(cubes.handles[0].guidance.hint?.current).toBe('R');
  expect(cubes.handles[1].guidance.hint?.current).toBe('R');
  move(0, 'R', 100, 'R');
  move(1, 'F', 110, 'F');
  expect(cubes.handles[0].guidance.hint?.current).toBe('U');
  expect(cubes.handles[1].guidance.hint?.corrections).toEqual(["F'"]);
  expect(fixupScramble).not.toHaveBeenCalled();
  act(() => {
    // No React render between completing the scramble and the first solve turn.
    callbacks[0].onMove?.('U', 200, toFaceletString(applyScramble(3, 'R U')));
    callbacks[0].onMove?.("U'", 300, toFaceletString(applyScramble(3, 'R')));
  });
  expect(useBattleStore.getState().players[0].isTiming).toBe(true);
  expect(useBattleStore.getState().players[0].startTime).toBe(300);
  expect(useBattleStore.getState().players[1].isTiming).toBe(false);
  expect(cubes.handles[0].guidance.hint).toBe(null);
  expect(cubes.handles[1].guidance.hint?.corrections).toEqual(["F'"]);
});

it('starts guidance from two different off-path connection states and rejects stale solver replies', async () => {
  let resolveFirst!: (value: string) => void;
  let resolveSecond!: (value: string) => void;
  vi.mocked(fixupScramble)
    .mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { resolveSecond = resolve; }));
  setCube(0, 'F'); setCube(1, 'L'); render();
  expect(fixupScramble).toHaveBeenCalledTimes(2);
  await act(async () => { resolveSecond("L' R U"); });
  expect(cubes.handles[1].guidance.hint?.current).toBe("L'");
  expect(cubes.handles[1].guidance.correctionActive).toBe(true);
  act(() => useBattleStore.setState({ scrambles: ['F U', 'R U', 'R U', 'R U'], scrambleRevisions: [1, 0, 0, 0] }));
  await act(async () => { resolveFirst("F' R U"); });
  expect(cubes.handles[0].guidance.hint?.current).toBe('U');
  expect(cubes.handles[0].guidance.correctionActive).toBe(false);
  expect(cubes.handles[1].guidance.hint?.current).toBe("L'");
});

it('rechecks unchanged facelets when loading ends and when an identical scramble gets a new revision', () => {
  setCube(0, 'R U'); setCube(1, 'R');
  useBattleStore.setState({ scrambleLoadings: [true, true, false, false] });
  render();
  expect(useBattleStore.getState().players[0].canStart).toBe(false);
  expect(cubes.handles[1].guidance.hint).toBe(null);
  act(() => useBattleStore.setState({ scrambleLoadings: [false, false, false, false] }));
  expect(useBattleStore.getState().players[0].canStart).toBe(true);
  expect(cubes.handles[1].guidance.hint?.current).toBe('U');
  move(1, 'U', 100, 'R U');
  expect(cubes.handles[1].guidance.match).toBe(true);
  act(() => {
    useBattleStore.getState().cubeCancel(0);
    useBattleStore.getState().cubeCancel(1);
  });
  setCube(1, 'R');
  act(() => useBattleStore.setState({ scrambleRevisions: [1, 1, 0, 0] }));
  expect(cubes.handles[1].guidance.hint?.current).toBe('U');
  expect(cubes.handles[1].guidance.match).toBe(false);
});

it('does not start an armed player from future history', () => {
  setCube(0, 'R U'); render();
  expect(useBattleStore.getState().players[0].canStart).toBe(true);
  act(() => callbacks[0].onMove?.("U'", 100, toFaceletString(applyScramble(3, 'R')), { futureHistory: true }));
  expect(useBattleStore.getState().players[0].isTiming).toBe(false);
  expect(cubes.handles[0].guidance.match).toBe(true);
});

it('resumes preparation after another player’s connection panel cancels readiness', () => {
  setCube(0, 'R'); setCube(1, ''); render();
  move(0, 'U', 100, 'R U');
  expect(useBattleStore.getState().players[0].canStart).toBe(true);
  render(true);
  expect(useBattleStore.getState().players[0].canStart).toBe(false);
  move(0, "U'", 200, 'R');
  render();
  expect(cubes.handles[0].guidance.hint?.current).toBe('U');
  expect(cubes.handles[1].guidance.hint?.current).toBe('R');
  move(0, 'U', 300, 'R U');
  expect(useBattleStore.getState().players[0].canStart).toBe(true);
});

it('atomically persists both players’ complete recordings even for the same scramble and time', async () => {
  updateSettings({ recordGyro: true });
  setCube(0, 'R U'); setCube(1, 'R U'); render();
  move(0, "U'", 1000, 'R');
  act(() => callbacks[0].onGyro?.({ x: 0, y: 0, z: 0, w: 1 }));
  move(0, "R'", 2000, '');
  act(() => callbacks[0].onSolved?.(2000));
  expect(useBattleStore.getState().battleRounds).toHaveLength(0);
  move(1, "U'", 1200, 'R');
  move(1, 'F', 1400, 'R F');
  move(1, "F'", 1700, 'R');
  act(() => callbacks[1].onGyro?.({ x: 0, y: 0, z: 0, w: 1 }));
  move(1, "R'", 2200, '');
  await act(async () => callbacks[1].onSolved?.(2200));
  const state = useBattleStore.getState();
  expect(state.battleRounds).toHaveLength(1);
  const round = state.battleRounds[0];
  expect(round.attempts.map(attempt => attempt.solve.timeMs)).toEqual([1000, 1000]);
  expect(round.attempts.map(attempt => attempt.solve.moves?.map(move => move.m))).toEqual([
    ["U'", "R'"], ["U'", 'F', "F'", "R'"],
  ]);
  expect(round.attempts.map(attempt => attempt.solve.device?.name)).toEqual(['Cube 0', 'Cube 1']);
  for (const { solve } of round.attempts) {
    expect(solve.gyro).toEqual(expect.any(String));
    expect(solve.stageSegments).toBeDefined();
    expect(solve.moves?.at(-1)?.ts).toBe(1000);
  }
  const stored = JSON.parse(localStorage.getItem(`battle_rounds_v1_${state.sessionId}`)!);
  expect(decodeLocalBattleRounds(stored)).toEqual(state.battleRounds);
  // P2 belongs in the battle history, never in the user's personal statistics.
  expect(appendSolves).toHaveBeenCalledTimes(1);
  expect(vi.mocked(appendSolves).mock.calls[0][1][0].moves).toEqual(round.attempts[0].solve.moves);
  act(() => useBattleStore.getState().handlePenalty(1, '+2'));
  expect(useBattleStore.getState().battleRounds[0].attempts[1].solve.moves).toEqual(round.attempts[1].solve.moves);
  act(() => {
    // Supply the next generated scramble before the reset, as the store requires.
    useBattleStore.setState({ scrambles: ['F U', 'F U', 'R U', 'R U'], scrambleLoadings: [false, false, false, false] });
    useBattleStore.getState().resetForNextRound();
  });
  expect(useBattleStore.getState().players.slice(0, 2).map(player => player.recording)).toEqual([undefined, undefined]);
});
