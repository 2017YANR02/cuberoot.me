import { NetBattleAttemptRecorder, netAttemptSolveId, type NetRecordedAttempt } from '@cuberoot/shared/timer';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { SmartCubeAttemptProducer } from '@cuberoot/shared/timer/smart-cube-attempt';
import { decodeGyroTrack } from '@cuberoot/shared/smart-cube/gyro-track';

const ref = <T>(current: T) => ({ current });
function source(path: string) {
  return ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
const local = source('../app/[lang]/timer/_battle/useBattleCubes.ts');
const net = source('../app/[lang]/timer/_shell/NetBattleView.tsx');

// Execute the actual host callbacks with the real shared producer. This catches
// ordering and ownership regressions that testing the producer alone cannot.
function callback(source: ts.SourceFile, find: (node: ts.Node) => ts.Node | undefined,
  context: Record<string, unknown>) {
  let match: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    match ??= find(node);
    if (!match) ts.forEachChild(node, visit);
  };
  visit(source);
  if (!match) throw new Error('Battle callback not found');
  return runInNewContext(ts.transpileModule(`(${match.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
}
const named = (name: string) => (node: ts.Node) => ts.isVariableDeclaration(node)
  && node.name.getText() === name && node.initializer && ts.isCallExpression(node.initializer)
  ? node.initializer.arguments[0] : undefined;

function localHarness() {
  const emptyTrack = () => ({ attempt: '', recorder: new SmartCubeAttemptProducer(), scramble: '', event: '333' });
  const state = {
    cubeMode: 'shared', cubeHolder: 0, puzzleIds: ['333', '333'], scrambles: ['R U', 'F'],
    players: [0, 1].map(() => ({ isTiming: true, startTime: 1_000, time: 500, penalty: 0, canStart: true })),
    cubeStop: vi.fn(() => true), cubeStart: vi.fn(() => true),
  };
  const trackRef = ref([emptyTrack(), emptyTrack()]);
  const handlesRef = ref([{ status: { connected: true, brand: 'gan-v4', deviceName: 'Original' } }]);
  const appendSolves = vi.fn();
  const context: Record<string, unknown> = {
    SmartCubeAttemptProducer, trackRef, handlesRef, emptyTrack,
    useBattleStore: { getState: () => state },
    attemptKey: (owner: number, start: number) => `${owner}:${start}`,
    ownerOf: (slot: number, mode: string, holder: number) => mode === 'shared' ? holder : slot,
    slotCounts: (slot: number, mode: string) => mode !== 'shared' || slot === 0,
    recordsToLocalHistory: (slot: number, mode: string, holder: number) => mode === 'shared' ? slot === 0 && holder === 0 : slot === 0,
    timerSupportsLocalBattleSmartCube: () => true,
    battleToTimerEvent: (event: string) => event,
    gyroStartRef: ref([0, 0]), lastMoveAtRef: ref([0, 0]), armedRef: ref([false, false]),
    performance: { now: () => 1_250 }, PENALTY: { DNF: 2, PLUS2: 1 },
    makeSolve: (solve: unknown) => solve, appendSolves,
  };
  context.syncTrack = callback(local, named('syncTrack'), context);
  return { state, trackRef, handlesRef, appendSolves,
    move: callback(local, named('onMove'), context),
    gyro: callback(local, named('onGyro'), context),
    solved: callback(local, named('onSolved'), context) };
}

describe('local battle shared attempt', () => {
  it('persists first/final moves, gyro, segments and the original device', () => {
    const h = localHarness();
    h.move(0, "U'", 1_000);
    h.gyro(0, { w: 1, x: 0, y: 0, z: 0 });
    h.handlesRef.current[0]!.status.deviceName = 'Replacement';
    h.move(0, "R'", 1_500);
    h.solved(0, 1_500);
    const solve = h.appendSolves.mock.calls[0]![1][0];
    expect(solve.moves).toEqual([{ m: "U'", ts: 0 }, { m: "R'", ts: 500 }]);
    expect(solve.device.name).toBe('Original');
    expect(solve.stageSegments.solvedMs).toBe(500);
    expect(decodeGyroTrack(solve.gyro)?.[0]?.tMs).toBe(250);
    h.solved(0, 1_500);
    expect(h.appendSolves).toHaveBeenCalledTimes(1);
  });

  it('isolates the next holder and never writes another player into personal history', () => {
    const h = localHarness();
    h.move(0, 'R', 1_000);
    h.state.cubeHolder = 1;
    h.move(0, "F'", 1_500);
    expect(h.trackRef.current[0]!.recorder.snapshotMoves()).toEqual([{ m: "F'", ts: 500 }]);
    h.solved(0, 1_500);
    expect(h.appendSolves).not.toHaveBeenCalled();
    expect(h.trackRef.current[0]!.recorder.snapshotMoves()).toEqual([]);
  });

  it('drops cancelled attempts and isolates the next keyboard start', () => {
    const h = localHarness();
    h.move(0, 'R', 1_000);
    const abandoned = h.trackRef.current[0]!.recorder;
    h.state.cubeStop.mockReturnValueOnce(false);
    h.solved(0, 1_200);
    expect(abandoned.recordMove('F', 1_250)).toBe(false);
    expect(h.appendSolves).not.toHaveBeenCalled();
    h.state.players[0]!.startTime = 2_000;
    h.move(0, "U'", 2_000);
    h.move(0, "R'", 2_500);
    h.solved(0, 2_500);
    expect(h.appendSolves.mock.calls[0]![1][0].moves).toEqual([{ m: "U'", ts: 0 }, { m: "R'", ts: 500 }]);
  });
});

describe('online battle shared attempt', () => {
  it.each(['timer', 'cube'])('preserves the %s start across effects, room updates and disconnects', (mode) => {
    const producer = new NetBattleAttemptRecorder();
    const roomRef = ref({ code: '1234', round: 7, scramble: 'R U', event: '333' });
    const appendSolves = vi.fn(async (_record: NetRecordedAttempt, _upload: boolean) => undefined);
    const context = {
      netAttemptSolveId,
      getNetRoom: vi.fn(),
      roomRef, pidRef: ref('self'), credentialsRef: ref({ playerId: 'self', playerToken: 'token' }),
      attemptAuthRef: ref(null), getActiveSessionId: () => 'original-session',
      roomController: { poll: vi.fn() },
      netRecordingOutbox: { enqueue: appendSolves }, postNetResult: vi.fn(async () => ({})), applyState: vi.fn(), tr: vi.fn(), setErr: vi.fn(),
      btStatusRef: ref({ connected: true, brand: 'gan-v4', deviceName: 'Original' }),
      netAttemptRef: ref(producer), phaseRef: ref('ready'), localSolveRef: ref(null),
      cubeStartedRef: ref(false), gateRef: ref(false), startAtRef: ref(null), canSolveRef: ref(true),
      timer: { phase: 'running', startFromCube: (_timestamp: number) => false },
      myScramble: (r: typeof roomRef.current) => r.scramble,
      playerEventOf: (r: typeof roomRef.current) => r.event,
      netEventToSelectorId: (event: string) => event,
      makeSolve: () => ({ id: 'solve-1', ts: 1000 }), appendSolves,
    };
    const start = callback(net, node => ts.isCallExpression(node)
      && node.expression.getText() === 'useTimer' ? node.arguments[1] : undefined, context);
    context.timer.startFromCube = (timestamp) => { start(timestamp); return true; };
    const startCube = callback(net, node => ts.isBinaryExpression(node)
      && node.left.getText() === 'startFromCubeRef.current' ? node.right : undefined, context);
    if (mode === 'cube') startCube(1_000);
    else start(1_000);
    expect(context.phaseRef.current).toBe('running');
    producer.recordMove("U'", 1_000);
    const phaseEffect = callback(net, node => ts.isCallExpression(node)
      && node.expression.getText() === 'useEffect'
      && node.arguments[0]?.getText().includes('netAttemptRef.current.reset()')
      ? node.arguments[0] : undefined, context);
    phaseEffect();
    roomRef.current = { code: '5678', round: 8, scramble: 'F', event: '222' };
    context.btStatusRef.current.connected = false;
    producer.recordMove("R'", 1_500);
    const solve = callback(net, named('onSolve'), context);
    solve({ timeMs: 500, autoPenalty: '+2', inspectionMs: 15_100 });
    expect(appendSolves.mock.calls[0]?.[1]).toBe(true);
    const saved = appendSolves.mock.calls[0]![0].solve;
    expect(appendSolves.mock.calls[0]![0].context.sessionId).toBe('original-session');
    expect(saved).toMatchObject({ event: '333', scramble: 'R U', timeMs: 500, penalty: '+2',
      inspectionMs: 15_100, device: { name: 'Original' }, stageSegments: { solvedMs: 500 },
      moves: [{ m: "U'", ts: 0 }, { m: "R'", ts: 500 }] });
    solve({ timeMs: 500, autoPenalty: 'ok', inspectionMs: 0 });
    expect(appendSolves).toHaveBeenCalledTimes(1);
    start(2_000);
    producer.recordMove('R', 2_000);
    context.timer.phase = 'idle';
    phaseEffect();
    expect(producer.recordMove('U', 2_100)).toBe(false);
    expect(producer.finish({ timeMs: 0, inspectionMs: 0, autoPenalty: 'ok' })).toBeNull();
  });
});
