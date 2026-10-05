import { describe, expect, it, vi } from 'vitest';
import { NetBattleAttemptRecorder, NetRecordingOutbox, upsertNetRecordedSolve, type NetAttemptContext, type Solve } from '@cuberoot/shared/timer';
import { decodeGyroTrack } from '@cuberoot/shared/smart-cube/gyro-track';

const context: NetAttemptContext = { code: '1234', playerId: 'self', round: 7, sessionId: 'original', id: 'solve-7', ts: 1000, event: '333', scramble: 'R U' };
const result = { timeMs: 500, inspectionMs: 15100, autoPenalty: '+2' as const };
function recorded(id = 'solve-7') {
  const recorder = new NetBattleAttemptRecorder();
  recorder.begin({ ...context, id }, 1000, { model: 'gan-v4', name: 'Original' });
  recorder.recordMove("U'", 1000);
  recorder.recordMove("R'", 1500);
  return recorder.finish(result)!.record!;
}

describe('online recording and local persistence', () => {
  it('freezes the attempt, keeps first/final moves and gyro, and binds penalty to the exact room round', () => {
    const recorder = new NetBattleAttemptRecorder();
    const start = { ...context };
    recorder.begin(start, 1000, { model: 'gan-v4', name: 'Original' });
    recorder.recordMove("U'", 1000);
    recorder.recordGyro({ w: 1, x: 0, y: 0, z: 0 }, 1250);
    start.round = 8; start.sessionId = 'other'; start.scramble = 'F';
    recorder.recordMove("R'", 1500);
    const completed = recorder.finish(result)!;
    expect(completed.context).toEqual(context);
    expect(completed.record!.solve).toMatchObject({ id: 'solve-7', scramble: 'R U', penalty: '+2', inspectionMs: 15100,
      moves: [{ m: "U'", ts: 0 }, { m: "R'", ts: 500 }], stageSegments: { solvedMs: 500 } });
    expect(decodeGyroTrack(completed.record!.solve.gyro!)![0].tMs).toBe(250);
    expect(recorder.penalty({ ...context, round: 8 }, 'dnf')).toBeNull();
    expect(recorder.penalty(context, 'dnf')!.solve.penalty).toBe('DNF');
    expect(recorder.finish(result)).toBeNull();
  });

  it('retains failed recordings across later rounds and retries into their original session', async () => {
    const stored = new Map<string, Solve[]>();
    let fail = true;
    const save = vi.fn(async (record: ReturnType<typeof recorded>) => {
      if (fail) throw Error('disk unavailable');
      stored.set(record.context.sessionId, upsertNetRecordedSolve(stored.get(record.context.sessionId) ?? [], record.solve));
    });
    const outbox = new NetRecordingOutbox(save);
    const first = recorded();
    await outbox.enqueue(first);
    const second = recorded('solve-8'); second.context.sessionId = 'other';
    await outbox.enqueue(second);
    expect(outbox.getSnapshot()).toEqual({ pending: 2, busy: false });
    fail = false;
    await outbox.retry();
    await outbox.enqueue({ ...first, solve: { ...first.solve, penalty: 'DNF' } });
    expect(outbox.getSnapshot().pending).toBe(0);
    expect(stored.get('original')).toHaveLength(1);
    expect(stored.get('original')![0].penalty).toBe('DNF');
    expect(stored.get('other')![0].id).toBe('solve-8');
  });

  it('serializes a penalty update behind an unfinished initial save', async () => {
    const records: Solve[] = [];
    let release!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    const outbox = new NetRecordingOutbox(async record => { await blocked; records.push(record.solve); });
    const first = recorded();
    const saving = outbox.enqueue(first);
    await Promise.resolve();
    void outbox.enqueue({ ...first, solve: { ...first.solve, penalty: 'DNF' } });
    release(); await saving;
    expect(records.map(solve => solve.penalty)).toEqual(['+2', 'DNF']);
    expect(outbox.getSnapshot().pending).toBe(0);
  });
});
