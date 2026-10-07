import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import {
  SmartCubeSoloTimerController,
  type SmartCubeSoloTimerContext,
} from '@cuberoot/shared/smart-cube/solo-timer';
import type { TimerPhase } from '@cuberoot/shared/timer';
import { describe, expect, it } from 'vitest';

function target(scramble: string): string {
  const facelets = smartCubeTargetFacelets(scramble);
  if (!facelets) throw new Error(`invalid fixture scramble: ${scramble}`);
  return facelets;
}

function harness(initialContext: SmartCubeSoloTimerContext = {
  event: '333',
  id: 1,
  scramble: 'R',
  targetFacelets: target('R'),
}) {
  let phase: TimerPhase = 'idle';
  let timingEnabled = true;
  let canStart = true;
  let autoReady = true;
  let beforeStart: ((timestamp: number) => void) | null = null;
  const order: string[] = [];
  let controller!: SmartCubeSoloTimerController;
  controller = new SmartCubeSoloTimerController({
    armFromCube: () => {
      order.push('arm');
      phase = 'ready';
      return true;
    },
    autoReadyOnScramble: () => autoReady,
    canStartAttempt: () => canStart,
    getPhase: () => phase,
    isTimingEnabled: () => timingEnabled,
    onMove: ({ move }) => { order.push(`deliver:${move}`); },
    recordMove: ({ move }) => { order.push(`record:${move}`); },
    solve: async () => null,
    startFromCube: (timestamp) => {
      beforeStart?.(timestamp);
      order.push(`start:${timestamp}`);
      if (phase !== 'ready' && phase !== 'inspecting') return false;
      phase = 'running';
      return true;
    },
    stopFromCube: (timestamp) => {
      order.push(`stop:${timestamp ?? 'none'}`);
      if (phase !== 'running') return false;
      phase = 'stopped';
      return true;
    },
  });
  controller.setContext(initialContext);
  controller.setConnected(true);
  return {
    controller,
    order,
    phase: () => phase,
    setAutoReady: (value: boolean) => { autoReady = value; },
    setBeforeStart: (callback: ((timestamp: number) => void) | null) => { beforeStart = callback; },
    setCanStart: (value: boolean) => { canStart = value; },
    setPhase: (value: TimerPhase) => { phase = value; },
    setTimingEnabled: (value: boolean) => { timingEnabled = value; },
  };
}

describe('SmartCubeSoloTimerController', () => {
  it.each(['cross', 'f2l', 'oll', 'coll', 'cmll', 'cll', 'ollcp', 'eocp', 'zbls'] as const)('%s records the finishing move before stopping with the cube still unsolved', (event) => {
    const state = harness({ event, id: 1, scramble: 'U R', orientation: '', targetFacelets: target('U R') });
    state.controller.syncFacelets(target('U R'));
    state.setPhase('ready');
    state.controller.move({ facelets: target('U'), move: "R'", timestamp: 500 });
    expect(state.phase()).toBe('stopped');
    expect(state.order).toEqual(['start:500', "record:R'", 'stop:500', "deliver:R'"]);
    expect(state.controller.solved(500)).toBe(false);
    expect(state.order.filter((entry) => entry.startsWith('stop:'))).toHaveLength(1);
  });

  it('pins the training goal and orientation at start, and does not finish on a state snapshot', () => {
    const state = harness({ event: 'oll', id: 1, scramble: 'U R', orientation: 'z2', targetFacelets: target('D L') });
    state.controller.syncFacelets(target('D L'));
    state.setPhase('running');
    state.controller.setRunning(true);
    state.controller.setContext({ event: '333', id: 2, scramble: 'R', targetFacelets: target('R'), orientation: '' });
    state.controller.syncFacelets(target('D'));
    expect(state.phase()).toBe('running');
    expect(state.controller.solved(100)).toBe(false);
    state.controller.move({ facelets: target('D L'), move: 'L', timestamp: 200 });
    state.controller.move({ facelets: target('D'), move: "L'", timestamp: 300 });
    expect(state.phase()).toBe('stopped');
    expect(state.order).toEqual(['record:L', 'deliver:L', "record:L'", 'stop:300', "deliver:L'"]);
  });

  it('does not stop a training attempt already complete before its first turn', () => {
    const state = harness({ event: 'oll', id: 1, scramble: 'U', targetFacelets: target('U') });
    state.controller.syncFacelets(target('U'));
    state.setPhase('ready');
    state.controller.move({ facelets: target('U2'), move: 'U', timestamp: 100 });
    expect(state.phase()).toBe('running');
    state.controller.move({ facelets: target('U2 R'), move: 'R', timestamp: 200 });
    state.controller.move({ facelets: target('U2'), move: "R'", timestamp: 300, metadata: { futureHistory: true } });
    expect(state.phase()).toBe('stopped');
    expect(state.order.slice(-2)).toEqual(["record:R'", 'stop:300']);
  });

  it.each(['pll', 'll', 'zbll', 'ell', '2gll', 'zzll', 'lse', 'l10p'] as const)('%s still waits for the final AUF and the transport solved edge', (event) => {
    const state = harness({ event, id: 1, scramble: 'U R', targetFacelets: target('U R') });
    state.setPhase('ready');
    state.controller.move({ facelets: target('U'), move: "R'", timestamp: 100 });
    expect(state.phase()).toBe('running');
    state.controller.move({ facelets: target(''), move: "U'", timestamp: 200 });
    expect(state.controller.solved(200)).toBe(true);
    expect(state.order.slice(-3)).toEqual(["record:U'", "deliver:U'", 'stop:200']);
  });

  it('uses yellow-top physical moves for readiness but records raw device moves at start', () => {
    const state = harness({ event: 'zbll', id: 1, scramble: 'R U', orientation: 'z2', targetFacelets: target('L D') });
    expect(state.controller.syncFacelets(target('')).hint?.current).toBe('R');
    state.controller.move({ facelets: target('L'), move: 'L', timestamp: 100 });
    expect(state.controller.syncFacelets(target('L')).hint?.current).toBe('U');
    state.controller.move({ facelets: target('L D'), move: 'D', timestamp: 200 });
    expect(state.phase()).toBe('ready');
    state.controller.move({ facelets: target('L'), move: "D'", timestamp: 300 });
    expect(state.order.slice(-3)).toEqual(['start:300', "record:D'", "deliver:D'"]);
  });

  it.each(['cross', 'f2l', 'll', 'oll', 'pll', 'coll', 'cmll', 'zbll'] as const)(
    '%s: training notation arms only after the full scramble, then starts on the next turn',
    (event) => {
      const state = harness({ event, id: 1, scramble: "r U2'", targetFacelets: target("r U2'") });
      // r is physically L plus a regrip; its following U is the device's F.
      expect(state.controller.move({ facelets: target('L'), move: 'L', timestamp: 100 }).guidanceCompleted).toBe(false);
      expect(state.controller.move({ facelets: target('L F'), move: 'F', timestamp: 200 }).guidanceCompleted).toBe(false);
      expect(state.phase()).toBe('idle');
      expect(state.controller.move({ facelets: target('L F2'), move: 'F', timestamp: 300 }).guidanceCompleted).toBe(true);
      expect(state.phase()).toBe('ready');
      expect(state.order.filter((entry) => entry === 'arm')).toHaveLength(1);
      expect(state.controller.move({ facelets: target("L F2 R'"), move: "R'", timestamp: 400 })).toMatchObject({ started: true, recorded: true });
      expect(state.phase()).toBe('running');
      expect(state.order.slice(-3)).toEqual(['start:400', "record:R'", "deliver:R'"]);
    },
  );

  it('starts an armed attempt before recording and delivering its first turn', () => {
    const state = harness();
    state.setPhase('ready');

    const outcome = state.controller.move({
      facelets: target('R U'),
      move: 'U',
      timestamp: 1_250,
    });

    expect(outcome).toEqual({
      delivered: true,
      futureHistory: false,
      guidanceCompleted: false,
      recorded: true,
      started: true,
    });
    expect(state.phase()).toBe('running');
    expect(state.order).toEqual(['start:1250', 'record:U', 'deliver:U']);
  });

  it('records recovered history only while running and never rebroadcasts it', () => {
    const state = harness();
    state.setPhase('running');
    state.controller.setRunning(true);

    const recovered = state.controller.move({
      facelets: target('R U'),
      metadata: { futureHistory: true },
      move: 'U',
      timestamp: 1_250,
    });
    const live = state.controller.move({
      facelets: target('R U F'),
      move: 'F',
      timestamp: 1_500,
    });

    expect(recovered).toMatchObject({ delivered: false, recorded: true, started: false });
    expect(live).toMatchObject({ delivered: true, recorded: true, started: false });
    expect(state.order).toEqual(['record:U', 'record:F', 'deliver:F']);
  });

  it('arms only from a real move completion, never from authoritative state sync', () => {
    const state = harness();
    const scrambled = target('R');

    expect(state.controller.syncFacelets(scrambled).match).toBe(true);
    expect(state.order).toEqual([]);
    const outcome = state.controller.move({ facelets: scrambled, move: 'R', timestamp: 500 });

    expect(outcome.guidanceCompleted).toBe(true);
    expect(state.order).toEqual(['arm', 'deliver:R']);
    expect(state.phase()).toBe('ready');
  });

  it('does not auto-start BLD, but still stops a manually started BLD solve', () => {
    const state = harness({
      event: '333bld',
      id: 2,
      scramble: 'R',
      targetFacelets: target('R'),
    });
    state.controller.move({ facelets: target('R'), move: 'R', timestamp: 500 });
    expect(state.order).toEqual(['deliver:R']);

    state.setPhase('running');
    state.controller.setRunning(true);
    expect(state.controller.solved(1_500)).toBe(true);
    expect(state.order).toEqual(['deliver:R', 'stop:1500']);
  });

  it('keeps the event that entered running authoritative across a context switch', () => {
    const state = harness();
    state.setPhase('running');
    state.controller.setRunning(true);
    state.controller.setContext({
      event: '222',
      id: 3,
      scramble: 'R',
      targetFacelets: null,
    });

    expect(state.controller.solved(2_000)).toBe(true);
    expect(state.order).toEqual(['stop:2000']);
  });

  it('drops disconnected moves and refuses to observe a move against a reentrant new context', () => {
    const disconnected = harness();
    disconnected.controller.setConnected(false);
    expect(disconnected.controller.move({
      facelets: target('R'),
      move: 'R',
      timestamp: 500,
    })).toMatchObject({ delivered: false, recorded: false, started: false });
    expect(disconnected.order).toEqual([]);

    const state = harness();
    state.setPhase('ready');
    const replacement = {
      event: '333' as const,
      id: 4,
      scramble: 'F',
      targetFacelets: target('F'),
    };
    state.setBeforeStart(() => {
      state.controller.setContext(replacement);
      state.setPhase('idle');
    });
    state.controller.move({ facelets: replacement.targetFacelets, move: 'F', timestamp: 700 });
    expect(state.order).toEqual(['start:700', 'deliver:F']);
  });

  it('allows a running solve to stop after timing is disabled', () => {
    const state = harness();
    state.setPhase('running');
    state.controller.setRunning(true);
    state.setTimingEnabled(false);
    state.setCanStart(false);
    state.setAutoReady(false);

    expect(state.controller.solved(3_000)).toBe(true);
    expect(state.order).toEqual(['stop:3000']);
  });
});
