import { cubeMove } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { describe, expect, it, vi } from 'vitest';
import { invertAlg } from '@cuberoot/shared/alg-transform';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';

import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { createSmartCubeGuidanceController } from '@cuberoot/shared/smart-cube/scramble-guidance';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function equal(actual: unknown, expected: unknown, message: string) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) throw new Error(`${message}\nactual: ${left}\nexpected: ${right}`);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const flush = () => new Promise<void>((resolve) => { setTimeout(resolve, 0); });
const target = (scramble: string) => {
  const facelets = smartCubeTargetFacelets(scramble);
  assert(facelets, `invalid test scramble: ${scramble}`);
  return facelets;
};

it('invalidates correction work when the grip changes even if the physical target is unchanged', async () => {
  const pending = deferred<string | null>();
  const controller = createSmartCubeGuidanceController({ solve: () => pending.promise });
  const context = { id: 1, scramble: 'U', targetFacelets: target('U') };
  controller.setContext({ ...context, orientation: '' });
  controller.setConnected(true);
  controller.observe(target('R'));
  controller.setContext({ ...context, orientation: 'y' });
  pending.resolve("R' U");
  await flush();
  equal(controller.snapshot(), { correctionActive: false, hint: null, match: null }, 'old grip correction must not return');
  controller.syncFacelets(target(''));
  assert(controller.snapshot().hint?.current === 'U', 'new grip can rebuild guidance');
  controller.dispose();
});

async function completedNowIsAnEdgeAndBatchOrderIsSafe() {
  let solveCalls = 0;
  const controller = createSmartCubeGuidanceController({
    solve: async () => { solveCalls++; return null; },
  });
  const scramble = 'R U';
  const scrambled = target(scramble);
  controller.setContext({ id: 1, scramble, targetFacelets: scrambled });
  controller.setConnected(true);

  controller.syncFacelets(scrambled);
  assert(controller.snapshot().match, 'state sync may show a match');
  assert(controller.observe(scrambled).completedNow, 'target must complete guidance');
  assert(!controller.observe(scrambled).completedNow, 'completion must be a one-shot edge');

  controller.setRunning(true);
  controller.setRunning(false);
  controller.setContext({ id: 2, scramble, targetFacelets: scrambled });
  assert(controller.observe(scrambled).completedNow, 'a new slot with the same text must complete again');

  // Same-stack GAN batch: the host starts the armed solve before forwarding its
  // first turn, so guidance must not interpret that turn as a correction.
  controller.setRunning(true);
  const firstSolveTurn = cubeMove(scrambled, "U'");
  const firstTurn = controller.observe(firstSolveTurn);
  assert(!firstTurn.completedNow, 'first solve turn cannot complete guidance again');
  equal(firstTurn.state, { correctionActive: false, hint: null, match: null }, 'running clears guidance');
  assert(solveCalls === 0, 'a batched first solve turn must not request correction');
}

async function authoritativeStateCanBeReplayedAfterLifecycleChanges() {
  const controller = createSmartCubeGuidanceController({ solve: async () => null });
  const facelets = target('R');
  controller.setContext({ id: 1, scramble: 'R U', targetFacelets: target('R U') });
  controller.syncFacelets(facelets);
  equal(controller.snapshot(), { correctionActive: false, hint: null, match: null }, 'disconnected state stays hidden');

  controller.setConnected(true);
  controller.syncFacelets(facelets);
  assert(controller.snapshot().hint?.current === 'U', 'connected replay must restore the first hint');

  controller.setContext({ id: 2, scramble: 'R F', targetFacelets: target('R F') });
  controller.syncFacelets(facelets);
  assert(controller.snapshot().hint?.current === 'F', 'context replay must evaluate the unchanged facelets');
}

async function pendingSolveRechecksLatestFacelets() {
  const first = deferred<string | null>();
  const calls: string[] = [];
  const controller = createSmartCubeGuidanceController({
    solve: async (fromFacelets) => {
      calls.push(fromFacelets);
      return calls.length === 1 ? first.promise : "L' F' R U";
    },
  });
  controller.setContext({ id: 1, scramble: 'R U', targetFacelets: target('R U') });
  controller.setConnected(true);
  controller.observe(target('F'));
  controller.syncFacelets(target('F L'));
  assert(calls.length === 1, 'same-target observations must coalesce while pending');

  first.resolve("F' R U");
  await flush();
  equal(calls, [target('F'), target('F L')], 'requester must retry from latest facelets');
  assert(controller.snapshot().correctionActive, 'latest correction must become active');
  assert(controller.snapshot().hint?.current === "L'", 'latest correction hint must be published');
}

async function latestTargetWaitsForPendingTarget() {
  const first = deferred<string | null>();
  const calls: string[] = [];
  const targetA = target('R U');
  const targetB = target('L U');
  const controller = createSmartCubeGuidanceController({
    solve: async (_fromFacelets, targetFacelets) => {
      calls.push(targetFacelets);
      return targetFacelets === targetA ? first.promise : "F' L U";
    },
  });
  controller.setConnected(true);
  controller.setContext({ id: 1, scramble: 'R U', targetFacelets: targetA });
  controller.observe(target('F'));
  controller.setContext({ id: 2, scramble: 'L U', targetFacelets: targetB });
  controller.observe(target('F'));
  equal(calls, [targetA], 'new target must wait for the active solver');

  first.resolve("F' R U");
  await flush();
  equal(calls, [targetA, targetB], 'latest target must run after the stale target settles');
  equal(controller.snapshot().hint?.pending, ['L', 'U'], 'only the latest target may publish');
}

async function disconnectAndDisposeDropLateResults() {
  const disconnectedResult = deferred<string | null>();
  const disconnectedStates: unknown[] = [];
  const disconnected = createSmartCubeGuidanceController({
    onChange: (state) => disconnectedStates.push(state),
    solve: () => disconnectedResult.promise,
  });
  disconnected.setConnected(true);
  disconnected.setContext({ id: 1, scramble: 'R U', targetFacelets: target('R U') });
  disconnected.observe(target('F'));
  disconnected.setConnected(false);
  const afterDisconnect = disconnectedStates.length;
  disconnectedResult.resolve("F' R U");
  await flush();
  assert(disconnectedStates.length === afterDisconnect, 'disconnect must reject a late solver result');
  equal(disconnected.snapshot(), { correctionActive: false, hint: null, match: null }, 'disconnect resets guidance');
  disconnected.setConnected(true);
  assert(
    disconnected.observe(target('R U')).completedNow,
    'reconnect must permit the same slot to complete again',
  );

  const disposedResult = deferred<string | null>();
  const disposedStates: unknown[] = [];
  const disposed = createSmartCubeGuidanceController({
    onChange: (state) => disposedStates.push(state),
    solve: () => disposedResult.promise,
  });
  disposed.setConnected(true);
  disposed.setContext({ id: 1, scramble: 'R U', targetFacelets: target('R U') });
  disposed.observe(target('F'));
  const beforeDispose = disposedStates.length;
  disposed.dispose();
  assert(disposedStates.length === beforeDispose, 'dispose must not notify an unmounting consumer');
  const afterDispose = disposedStates.length;
  disposedResult.resolve("F' R U");
  await flush();
  assert(disposedStates.length === afterDispose, 'dispose must reject a late solver result');
}

async function runningDropsLateResultAndRecovers() {
  const pending = deferred<string | null>();
  const states: unknown[] = [];
  const controller = createSmartCubeGuidanceController({
    onChange: (state) => states.push(state),
    solve: () => pending.promise,
  });
  const scrambled = target('R U');
  controller.setContext({ id: 1, scramble: 'R U', targetFacelets: scrambled });
  controller.setConnected(true);
  controller.observe(target('F'));
  controller.setRunning(true);
  const afterRunning = states.length;
  pending.resolve("F' R U");
  await flush();
  assert(states.length === afterRunning, 'running must reject a late correction result');
  equal(controller.snapshot(), { correctionActive: false, hint: null, match: null }, 'running clears guidance');

  controller.setRunning(false);
  controller.setContext({ id: 2, scramble: 'R U', targetFacelets: scrambled });
  assert(controller.observe(scrambled).completedNow, 'a new slot must recover after running');
}

describe('shared smart-cube scramble guidance controller', () => {
  it('emits completion once per slot and preserves GAN batch order', completedNowIsAnEdgeAndBatchOrderIsSafe);
  it('replays authoritative state after lifecycle changes', authoritativeStateCanBeReplayedAfterLifecycleChanges);
  it('rechecks the latest facelets while a solve is pending', pendingSolveRechecksLatestFacelets);
  it('runs the latest target after a stale target settles', latestTargetWaitsForPendingTarget);
  it('drops late results after disconnect or dispose', disconnectAndDisposeDropLateResults);
  it('drops a late result while running and recovers for the next slot', runningDropsLateResultAndRecovers);
});

describe('undo before replanning', () => {
  function setup(scramble = 'R U', options: {
    limit?: number;
    orientation?: string;
    solve?: (from: string, to: string) => Promise<string | null>;
  } = {}) {
    const solve = vi.fn(options.solve ?? (async () => null));
    const controller = createSmartCubeGuidanceController({ solve, correctionLimit: () => options.limit });
    const targetFacelets = smartCubeTargetFacelets(scramble, options.orientation)!;
    controller.setContext({ id: 1, scramble, targetFacelets, orientation: options.orientation });
    controller.setConnected(true);
    let facelets = target('');
    controller.syncFacelets(facelets);
    return {
      controller, solve, targetFacelets,
      turn(move: string) {
        facelets = cubeMove(facelets, move);
        return controller.observe(facelets, move);
      },
      facelets: () => facelets,
    };
  }

  it('keeps the final normal move, merges undo turns, and removes corrections as they are undone', () => {
    const h = setup();
    h.turn('R');
    expect(h.turn('F').state.hint).toEqual({ displayMoves: expect.any(Array), done: ['R'], corrections: ["F'"], current: 'U', pending: [], complete: false });
    expect(h.turn('F').state.hint?.corrections).toEqual(['F2']);
    expect(h.turn("F'").state.hint?.corrections).toEqual(["F'"]);
    expect(h.turn("F'").state.hint).toEqual({ displayMoves: expect.any(Array), done: ['R'], current: 'U', pending: [], complete: false });
    expect(h.turn('U').completedNow).toBe(true);
    expect(h.solve).not.toHaveBeenCalled();
  });

  it('merges same-face wrong direction with the pending normal move', () => {
    const h = setup();
    expect(h.turn("R'").state.hint).toEqual({ displayMoves: expect.any(Array), done: [], corrections: ['R2'], current: 'U', pending: [], complete: false });
    // Either direction of the displayed half turn must reach the original path.
    expect(h.turn("R'").state.hint?.corrections).toEqual(["R'"]);
    expect(h.turn("R'").state.hint?.corrections).toBeUndefined();
    expect(h.turn('U').completedNow).toBe(true);
    expect(h.solve).not.toHaveBeenCalled();
  });

  it.each(['R', "R'"])('preserves the unfinished half turn after %s then a wrong face', (partial) => {
    const h = setup('R2 U');
    expect(h.turn(partial).state.hint?.current).toBe('R2');
    expect(h.turn('F').state.hint).toEqual({ displayMoves: expect.any(Array), done: [], corrections: ["F'"], current: partial, pending: ['U'], complete: false });
    h.turn("F'");
    h.turn(partial);
    expect(h.turn('U').completedNow).toBe(true);
    expect(h.solve).not.toHaveBeenCalled();
  });

  it('uses display orientation for red moves while tracking physical device moves', () => {
    const h = setup('R U', { orientation: 'y' });
    const physicalWrong = normalizeWcaScramble('y F')!;
    const hint = h.turn(physicalWrong).state.hint!;
    expect(hint.corrections).toEqual(["F'"]);
    expect(hint.current).toBe('R');
    h.turn(invertAlg(physicalWrong));
    expect(h.controller.snapshot().correctionActive).toBe(false);
  });

  it('keeps six merged undo moves, replans on seven, and rejects a late result after undoing back to six', async () => {
    const pending = deferred<string | null>();
    const h = setup('R U', { solve: () => pending.promise });
    h.turn('R');
    const wrong = ['F', 'L', 'B', 'D', 'R', 'F', 'B'];
    for (const move of wrong.slice(0, 6)) h.turn(move);
    expect(h.controller.snapshot().hint?.corrections).toHaveLength(6);
    expect(h.solve).not.toHaveBeenCalled();
    h.turn(wrong[6]);
    expect(h.solve).toHaveBeenCalledTimes(1);
    h.turn("B'");
    expect(h.controller.snapshot().hint?.corrections).toHaveLength(6);
    pending.resolve(`${invertAlg(wrong.join(' '))} U`);
    await flush();
    expect(h.controller.snapshot().hint?.corrections).toEqual(invertAlg(wrong.slice(0, 6).join(' ')).split(' '));
    expect(h.solve).toHaveBeenCalledTimes(1);
  });

  it('re-enters undo mode on the newly planned path and still reaches the same target', async () => {
    const h = setup('R U', { limit: 1, solve: async () => "L' F' U" });
    h.turn('R'); h.turn('F'); h.turn('L');
    await flush();
    expect(h.controller.snapshot().hint?.current).toBe("L'");
    expect(h.turn('B').state.hint?.corrections).toEqual(["B'"]);
    h.turn("B'"); h.turn("L'"); h.turn("F'");
    expect(h.turn('U').completedNow).toBe(true);
    expect(h.facelets()).toBe(h.targetFacelets);
    expect(h.solve).toHaveBeenCalledTimes(1);
  });

  it('allows zero to replan immediately and does not double-count repeated state frames', () => {
    const immediate = setup('R U', { limit: 0 });
    immediate.turn('F');
    expect(immediate.solve).toHaveBeenCalledTimes(1);
    const h = setup();
    h.turn('F');
    h.controller.syncFacelets(h.facelets());
    expect(h.controller.snapshot().hint?.corrections).toEqual(["F'"]);
    h.controller.syncFacelets(target('L B D'));
    expect(h.controller.snapshot().hint).toBeNull();
    expect(h.solve).toHaveBeenCalledTimes(1);
  });

  it('retries a solver result when a wrong-direction quarter turn arrives while solving', async () => {
    const pending = deferred<string | null>();
    const solve = vi.fn().mockImplementationOnce(() => pending.promise).mockResolvedValue("R' F' U");
    const controller = createSmartCubeGuidanceController({ solve });
    controller.setContext({ id: 1, scramble: 'U', targetFacelets: target('U') });
    controller.setConnected(true);
    controller.observe(target('F')); // Unknown starting state requires a route.
    controller.observe(target('F R'));
    pending.resolve("R' R F' U"); // R is the wrong direction for the first R'.
    await flush();
    expect(solve).toHaveBeenCalledTimes(2);
    expect(solve).toHaveBeenLastCalledWith(target('F R'), target('U'));
    expect(controller.snapshot().hint?.current).toBe("R'");
    controller.dispose();
  });
});
