import { describe, expect, it } from 'vitest';
import pll from '@cuberoot/shared/data/pll.json';
import { SmartCubeSoloTimerController } from '@cuberoot/shared/smart-cube/solo-timer';
import { SmartCubeAttemptProducer } from '@cuberoot/shared/timer/smart-cube-attempt';
import { initialTimerMachineState, transitionTimer } from '@cuberoot/shared/timer/machine';
import { decodeTimerSolve } from '@cuberoot/shared/timer/persistence';
import type { Solve } from '@cuberoot/shared/timer';
import { PllChainAttempt } from '@/lib/pll-chain';

describe('PLL chain in the existing timer pipeline', () => {
  it.each([false, true])('uses the normal start, recording, stop and persistence with clock reset=%s', resetClock => {
    const order = Object.keys(pll);
    let attempt!: PllChainAttempt;
    let state = initialTimerMachineState();
    let saved: Solve | undefined;
    let started = 0;
    const recorder = new SmartCubeAttemptProducer();
    const config = { inspectionSec: 15, trainingStartMode: 'first-turn' as const };
    const controller = new SmartCubeSoloTimerController({
      armFromCube: () => false,
      autoReadyOnScramble: () => true,
      canStartAttempt: () => true,
      isTimingEnabled: () => true,
      getPhase: () => state.phase,
      solve: async () => null,
      startFromCube: (timestamp, clock) => {
        const result = transitionTimer(state, { type: 'start-from-cube', nowMs: timestamp, atMs: timestamp, clock }, config);
        state = result.state;
        if (!result.accepted) return false;
        started++;
        attempt = new PllChainAttempt(order);
        recorder.begin(state.startedAtMs!, { name: 'GAN16ui test', model: 'gan-v4' }, undefined, state.cubeStart);
        return true;
      },
      recordMove: ({ move, timestamp, clock }) => { recorder.recordMove(move, timestamp, clock); },
      sequenceComplete: ({ move, facelets }) => { attempt.move(move, facelets); return attempt.verified && attempt.done; },
      stopFromCube: (timestamp, clock) => {
        const result = transitionTimer(state, { type: 'stop-from-cube', nowMs: timestamp!, atMs: timestamp, clock }, config);
        state = result.state;
        if (!result.solve) return false;
        saved = { id: 'chain', event: 'pll-chain', scramble: '', ts: 1000, timeMs: result.solve.timeMs, penalty: 'ok' };
        Object.assign(saved, recorder.finishSolveFields(saved));
        saved.pllChain = attempt.result(saved.moves!);
        return true;
      },
    });
    controller.setContext({ event: 'pll-chain', id: 1, scramble: '', targetFacelets: null });
    controller.setConnected(true);
    state = transitionTimer(state, { type: 'arm-from-cube', nowMs: 500 }, config).state;
    let count = 0;
    for (const id of order) {
      for (const move of pll[id as keyof typeof pll].noAuf.split(' ')) {
        if (state.phase === 'stopped') break;
        const timestamp = 1000 + count * 100;
        const clock = { epoch: resetClock && count > 0 ? 2 : 1, deviceTime: count * 50,
          timestamp, hostTime: timestamp, rate: 1.02 };
        const outcome = controller.move({ move, timestamp, clock, facelets: null });
        expect(outcome.recorded).toBe(true);
        expect(outcome.started).toBe(count === 0);
        // Even a solved transport notification must not end the chain early.
        expect(controller.solved(timestamp, clock)).toBe(false);
        count++;
      }
      expect(attempt.completed).toBe(order.indexOf(id) + 1);
      if (id !== order.at(-1)) expect(state.phase).toBe('running');
    }
    expect(started).toBe(1);
    expect(state.phase).toBe('stopped');
    expect(saved!.pllChain).toMatchObject({ order, verified: true });
    expect(saved!.moves).toHaveLength(count);
    expect(saved!.moves![0].ts).toBe(0);
    expect(saved!.timeMs).toBe((count - 1) * (resetClock ? 100 : 51));
    expect(saved!.pllChain!.splits.at(-1)!.elapsedMs).toBe(saved!.timeMs);
    expect(saved!.stageSegments).toBeUndefined();
    expect(decodeTimerSolve(JSON.parse(JSON.stringify(saved)), 'pll-chain')).toEqual(saved);
    expect(decodeTimerSolve(saved, '333')).toBeNull();
    controller.dispose();
  });
});
