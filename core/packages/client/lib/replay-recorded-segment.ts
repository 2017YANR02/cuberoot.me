import type { F2lTransferHit } from '@cuberoot/timer-ui/reconstruct/cfop-personal-baseline';
import type { CfopReplayRange } from '@cuberoot/timer-ui/reconstruct/cfop-diagnosis';
import { recordingRotation } from '@cuberoot/timer-ui/reconstruct/replay-view';
import { replayFingerprint } from '@cuberoot/shared/timer/replay-verified';
import { countExecutedHtm } from '@cuberoot/shared/timer/reconstruct/htm';
import { applyScramble, toFaceletString } from '@cuberoot/shared/timer/reconstruct/state';
import { applyOneToken } from '@cuberoot/shared/timer/reconstruct/stage-segments';
import { loadAllSessionData } from '@/app/[lang]/timer/_lib/storage/db';
import type { ReplayRecording } from './assistant-conversations';

export function readSegment(hit: F2lTransferHit) {
  for (const {byEvent} of loadAllSessionData()) {
    const solve = byEvent['333']?.find(s => s.id === hit.solveId && s.ts === hit.ts && s.timeMs === hit.timeMs
      && s.moves && replayFingerprint({event:s.event, scramble:s.scramble, moves:s.moves, totalMs:s.timeMs}) === hit.recordingKey);
    if (!solve?.moves) continue;
    return segment(solve as ReplayRecording, hit.range, true);
  }
}

export function segment(recording: ReplayRecording, range: CfopReplayRange, cfop: boolean, rotation?: string) {
  const {firstMoveIndex, endMoveIndex, startMs, endMs} = range;
  if (firstMoveIndex < 0 || endMoveIndex < firstMoveIndex || endMoveIndex >= recording.moves.length || endMs <= startMs) return;
  const setup = [recording.scramble, ...recording.moves.slice(0, firstMoveIndex).map(move => move.m)].join(' ');
  const moves = recording.moves.slice(firstMoveIndex, endMoveIndex + 1).map(move => ({...move, ts:move.ts-startMs}));
  return {setup, moves, rotation: cfop ? rotation ?? recordingRotation(recording) : undefined, duration:endMs-startMs};
}

/** Use the stored execution boundary; leading alignment turns belong to entry. */
export function readExecution(hit: F2lTransferHit) {
  const clip = readSegment(hit);
  if (!clip || clip.rotation === undefined) return;
  // Subtraction of absolute device timestamps can introduce sub-millisecond rounding.
  const start = clip.moves.findIndex(move => Math.abs(move.ts - hit.recognitionMs) < 0.001);
  if (start < 0 || Math.abs((clip.moves[start + 1]?.ts ?? Infinity) - hit.recognitionMs) < 0.001) return;
  const setup = [clip.setup, ...clip.moves.slice(0, start).map(move => move.m)].join(' ');
  const moves = clip.moves.slice(start).map(move => ({m: move.m, ts: move.ts - clip.moves[start].ts}));
  const turns = countExecutedHtm(moves);
  let state = applyScramble(3, setup);
  const seen = new Map<string, number>();
  let gap: {from: number; to: number; ms: number} | undefined;
  let loop: typeof gap;
  for (const [i, move] of moves.entries()) {
    if (i > 0) {
      const ms = move.ts - moves[i - 1].ts;
      if (!gap || ms > gap.ms) gap = {from: i - 1, to: i, ms};
    }
    state = applyOneToken(state, move.m);
    const key = toFaceletString(state);
    const previous = seen.get(key);
    if (previous !== undefined) {
      const ms = move.ts - moves[previous].ts;
      if (!loop || ms > loop.ms) loop = {from: previous, to: i, ms};
    } else seen.set(key, i);
  }
  return {hit, setup, rotation: clip.rotation, moves, turns, first: start + 1, gap, loop};
}
