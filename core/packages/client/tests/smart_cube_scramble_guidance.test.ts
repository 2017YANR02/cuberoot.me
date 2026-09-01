import { cubeMove } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { describe, it } from 'vitest';

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
