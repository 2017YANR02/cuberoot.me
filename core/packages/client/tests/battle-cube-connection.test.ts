// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { applyScramble, toFaceletString } from '@/app/[lang]/timer/_lib/cube/state';
import type { BluetoothCubeHandle } from '@/app/[lang]/timer/_lib/bluetooth';

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
vi.mock('@/app/[lang]/timer/_lib/storage/db', () => ({
  appendSolves: vi.fn(), makeSolve: (solve: unknown) => solve,
}));

const { useBluetoothCube } = await import('@/app/[lang]/timer/_lib/bluetooth');
const { useBattleCubes } = await import('@/app/[lang]/timer/_battle/useBattleCubes');
const { useBattleStore } = await import('@/app/[lang]/timer/_battle/engine/battle_store');
const { initialTimerMachineState } = await import('@cuberoot/shared/timer');
const { updateSettings } = await import('@/app/[lang]/timer/_lib/settings');
type Options = NonNullable<Parameters<typeof useBluetoothCube>[0]>;
let callbacks: Options[];
let handles: BluetoothCubeHandle[];
let root: Root;
let host: HTMLDivElement;
function Harness({ suspended = false }: { suspended?: boolean }) {
  useBattleCubes({ suspended });
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
  updateSettings({ bluetoothAutoReady: 'scrambled' });
  store.cancelReadyTimer();
  useBattleStore.setState({ mode: '1v1', playerCount: 2, syncStart: false, cubeMode: 'own', cubeHolder: 0,
    inspectionTime: 0, battleRounds: [], scrambles: ['R U', 'R U', 'R U', 'R U'],
    puzzleIds: ['333', '333', '333', '333'], scrambleLoadings: [false, false, false, false],
    scrambleErrors: [false, false, false, false],
    players: store.players.map(player => ({ ...player, timerState: initialTimerMachineState(),
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
