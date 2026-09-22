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
