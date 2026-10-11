// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyScramble, fromFaceletString, toFaceletString } from '@cuberoot/shared/timer/reconstruct/state';
import { SmartCubeSessionController } from '@cuberoot/shared/smart-cube/session';
import { useTrainerCube, type TrainerCubeState, type UseTrainerCubeOpts } from '@/app/[lang]/alg/_trainer/useTrainerCube';

const rig = vi.hoisted(() => ({ opts: {} as any, cube: {} as any, store: {} as any }));
vi.mock('@/lib/bluetooth', () => ({ useBluetoothCube: (opts: any) => { rig.opts = opts; return rig.cube; } }));
vi.mock('@/lib/bluetooth/fake_cube', () => ({ installFakeCube: vi.fn() }));
vi.mock('@/lib/kociemba/random_state', () => ({ solve333: vi.fn(async () => { throw Error('Unexpected anchor solve'); }) }));
vi.mock('@/lib/trainer-store', () => ({
  TimerState: { NOT_RUNNING: 0, RUNNING: 1, STOPPING: 2 },
  useTrainerStore: Object.assign((selector: any) => selector(rig.store), { getState: () => rig.store }),
}));

const facelets = (alg = '') => toFaceletString(applyScramble(3, alg));
let root: Root, host: HTMLDivElement, state: TrainerCubeState, options: UseTrainerCubeOpts;
function Harness() { state = useTrainerCube(options); return null; }
const draw = () => act(async () => { root.render(createElement(Harness)); });
const move = (token: string, alg: string, timestamp = 1000) => {
  rig.cube.facelets = facelets(alg);
  rig.opts.onMove(token, timestamp, rig.cube.facelets);
};

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear(); localStorage.setItem('trainer:smart-cube-practice', 'manual');
  rig.store = { timerState: 0,
    startTimer: vi.fn(() => { rig.store.timerState = 1; }),
    stopTimer: vi.fn(() => { rig.store.timerState = 2; }),
    setTimerState: vi.fn((next: number) => { rig.store.timerState = next; }), nextScramble: vi.fn(),
  };
  rig.cube = { status: { connected: true, deviceId: 'test' }, facelets: facelets(), hijacked: false,
    hijackTo: vi.fn(() => true), clearHijack: vi.fn(), getFaces: () => fromFaceletString(rig.cube.facelets),
    connect: vi.fn(), disconnect: vi.fn(),
  };
  options = { enabled: true, timing: true, puzzle: '3x3', sessionSet: 'zbll', currentCase: null,
    currentKey: 'test', currentScramble: 'R U', currentAttempt: {} };
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

describe('manual smart-cube training', () => {
  it('uses timer guidance for half turns, undo, mismatch and completion, then hides it while solving', async () => {
    options.timing = false;
    options.currentScramble = 'R2 U';
    await draw();
    expect(state.scrambleHint).toEqual({ done: [], current: 'R2', pending: ['U'], complete: false });
    await act(async () => move('R', 'R'));
    expect(state.scrambleHint?.current).toBe('R2');
    await act(async () => move('R', 'R2'));
    expect(state.scrambleHint).toEqual({ done: ['R2'], current: 'U', pending: [], complete: false });
    await act(async () => move("R'", 'R'));
    expect(state.scrambleHint?.current).toBe('R2');
    await act(async () => move('F', 'R F'));
    expect(state.scrambleHint).toBeNull();
    await act(async () => { move("F'", 'R'); move('R', 'R2'); move('U', 'R2 U'); });
    expect(state.scrambleHint?.complete).toBe(true);
    expect(state.reason).toBe('ready');
    await act(async () => move("U'", 'R2'));
    expect(state.reason).toBe('running');
    expect(state.scrambleHint).toBeNull();
  });

  it('recognizes the reported double-ZBLL scramble through the real Bluetooth state tracker', async () => {
    options.timing = false;
    options.currentScramble = "R B2 D' L' D B2 D' B2 R' B2 F2 L U L' F2 D' B2 L";
    const session = new SmartCubeSessionController({
      onChange: snapshot => { rig.cube.facelets = snapshot.facelets; },
      onMove: event => rig.opts.onMove(event.move, event.timestamp, event.facelets),
      onSolved: timestamp => rig.opts.onSolved(timestamp),
    }).open();
    await draw();
    const tokens = options.currentScramble.split(' ');
    for (const token of tokens) {
      await act(async () => { session.move(token); });
      await draw();
    }
    expect(state.reason).toBe('ready');
    for (const token of tokens.reverse()) {
      await act(async () => { session.move(token.endsWith('2') ? token : token.endsWith("'") ? token[0] : `${token}'`); });
      await draw();
    }
    expect(rig.store.nextScramble).toHaveBeenCalledTimes(1);
  });

  it('keeps the real solved cube, ignores scrambling, starts on the next turn and finishes once', async () => {
    localStorage.clear();
    await draw();
    expect(state.practiceMode).toBe('manual');
    expect(state.reason).toBe('scrambling');
    expect(state.armed).toBe(false);
    expect(rig.cube.hijackTo).not.toHaveBeenCalled();
    expect(state.physicalMoves).toEqual([]);
    await act(async () => { move('R', 'R'); move('U', 'R U', 1100); });
    expect(state.armed).toBe(true);
    expect(state.reason).toBe('ready');
    expect(rig.store.startTimer).not.toHaveBeenCalled();
    expect(state.physicalMoves).toEqual(['R', 'U']);
    await act(async () => { move("U'", 'R', 1300); });
    expect(rig.store.startTimer).toHaveBeenCalledTimes(1);
    expect(rig.store.startTimer).toHaveBeenCalledWith(performance.timeOrigin + 1300);
    await act(async () => { move("R'", '', 1700); rig.opts.onSolved(1700); rig.opts.onSolved(1700); });
    expect(rig.store.stopTimer).toHaveBeenCalledTimes(1);
    expect(rig.store.stopTimer).toHaveBeenCalledWith(performance.timeOrigin + 1700);
    expect(state.armed).toBe(false);
    // A new draw can repeat the exact same case and scramble.
    options = { ...options, currentAttempt: {} }; await draw();
    expect(state.reason).toBe('scrambling');
    await act(async () => { move('R', 'R'); move('U', 'R U'); });
    expect(state.reason).toBe('ready');
  });

  it('does not advance on a wrong scramble or a solved state-only resync', async () => {
    options.timing = false; await draw();
    await act(async () => { move('F', 'F'); rig.opts.onSolved(1000); });
    expect(state.armed).toBe(false);
    expect(rig.store.nextScramble).not.toHaveBeenCalled();
    await act(async () => { move('U', 'R U'); });
    await act(async () => { move("U'", 'R'); rig.opts.onSolved(); });
    expect(rig.store.nextScramble).not.toHaveBeenCalled();
    await act(async () => { move("R'", ''); rig.opts.onSolved(1500); });
    expect(rig.store.nextScramble).toHaveBeenCalledTimes(1);
    expect(rig.store.startTimer).not.toHaveBeenCalled();
    expect(rig.store.stopTimer).not.toHaveBeenCalled();
  });

  it('preserves virtual mode and persists switching back to manual without hijacking the next target', async () => {
    localStorage.setItem('trainer:smart-cube-practice', 'virtual'); await draw();
    expect(state.practiceMode).toBe('virtual');
    expect(rig.cube.hijackTo).toHaveBeenCalledWith(facelets('R U'), 'solved');
    expect(state.scrambleHint).toBeNull();
    await act(async () => state.setPracticeMode('manual'));
    expect(localStorage.getItem('trainer:smart-cube-practice')).toBe('manual');
    expect(state.reason).toBe('scrambling');
    expect(rig.cube.clearHijack).toHaveBeenCalled();
    rig.cube.hijackTo.mockClear();
    options = { ...options, currentScramble: 'F R', currentAttempt: {} }; await draw();
    expect(rig.cube.hijackTo).not.toHaveBeenCalled();
  });

  it('does not allow mode changes during an untimed physical solve and disarms on disconnect', async () => {
    options.timing = false; await draw();
    await act(async () => { move('U', 'R U'); move("U'", 'R'); });
    await act(async () => state.setPracticeMode('virtual'));
    expect(state.practiceMode).toBe('manual');
    rig.cube.status.connected = false; await draw();
    expect(state.reason).toBe('disconnected');
    expect(state.armed).toBe(false);
    rig.cube.status.connected = true; await draw();
    expect(state.reason).toBe('scrambling');
  });

  it('revokes readiness when an authoritative state resync no longer matches the target', async () => {
    await draw();
    await act(async () => { move('U', 'R U'); });
    expect(state.reason).toBe('ready');
    rig.cube.facelets = facelets('F'); await draw();
    expect(state.armed).toBe(false);
    expect(state.reason).toBe('scrambling');
    await act(async () => move('R', 'F R'));
    expect(rig.store.startTimer).not.toHaveBeenCalled();
  });
});
