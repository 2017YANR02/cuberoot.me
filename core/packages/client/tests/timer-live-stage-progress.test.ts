import { describe, expect, it } from 'vitest';
import { IncrementalCfopProgress } from '@cuberoot/shared/timer/reconstruct/orient';
import { computeStageSegments } from '@cuberoot/shared/timer';
import { TimerAttemptSplitRecorder } from '@cuberoot/shared/timer';
import fixtures from './fixtures/recon-ground-truth.json';

const stageTimes = (s: ReturnType<typeof computeStageSegments>) => ({
  crossDoneMs: s?.crossDoneMs ?? null, f2lDoneMs: s?.f2lDoneMs ?? null, ollDoneMs: s?.ollDoneMs ?? null,
});

describe('incremental live CFOP timing', () => {
  it.each(fixtures.fixtures)('matches every recorded prefix of confirmed solve $id', fixture => {
    const replay = JSON.parse(Buffer.from(fixture.replay, 'base64url').toString());
    const moves = replay.m.map(([m, ts]: [string, number]) => ({ m, ts }));
    const progress = new IncrementalCfopProgress(replay.s, true);
    for (let i = 0; i < moves.length; i++) {
      progress.push(moves[i]);
      expect(progress.stages(), `move ${i}`).toEqual(stageTimes(computeStageSegments(replay.s, moves.slice(0, i + 1), moves[i].ts)));
    }
  });

  it.each(['R U F', 'z2 R U', 'bad scramble', ''])('preserves tolerant rotation/slice/wide/unknown-token behavior for %s', scramble => {
    const moves = "R U R' U' M E S Rw x z2 Q U R'".split(' ').map((m, i) => ({ m, ts: i * 50 }));
    const progress = new IncrementalCfopProgress(scramble, true);
    for (let i = 0; i < moves.length; i++) {
      progress.push(moves[i]);
      expect(progress.stages()).toEqual(stageTimes(computeStageSegments(scramble, moves.slice(0, i + 1), moves[i].ts)));
    }
  });

  it('rebuilds on corrected timestamps and a replaced scramble, while manual splits stay authoritative', () => {
    const recorder = new TimerAttemptSplitRecorder();
    recorder.begin({ multiStage: true, bldMemo: false });
    recorder.markStage('cross', 10);
    recorder.observeMoves({ event: '333', scramble: 'R', moves: [{ m: "R'", ts: 50 }], timeMs: 50 });
    recorder.observeMoves({ event: '333', scramble: 'R', moves: [{ m: "R'", ts: 60 }], timeMs: 60 });
    expect(recorder.snapshot().stages).toEqual({ cross: 10, f2l: 60, oll: 60 });
    recorder.observeMoves({ event: '333', scramble: 'U', moves: [{ m: "U'", ts: 80 }], timeMs: 80 });
    expect(recorder.snapshot().stages).toEqual({ cross: 10, f2l: 80, oll: 80 });
  });
});
