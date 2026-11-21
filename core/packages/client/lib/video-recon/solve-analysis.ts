import { getCube3 } from '@cuberoot/shared/recon/cube3';
import type { CoreTrack } from '@cuberoot/shared/timer/reconstruct/core-track';
import { facePermFor, type CubeFace } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { detectSolveMethod } from '@cuberoot/shared/timer/reconstruct/method-walk';
import { buildReconText, formattedReconMoves, formatReconLine, prepareReconstruction, type ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { RotationEvent } from '@cuberoot/shared/timer/reconstruct/rotation-detect';
import { findTokenPositions } from '@/lib/recon-alg-utils';
import { centerColorsForScramble } from './engine/cube-colors';
import { CAMERA_ORIENTATION, CUBE_GRIP_ROTATIONS, initialGripMoves, relativeCubeGrip } from './engine/cube-orientation';
import type { MoveStep } from './engine/move-search-types';
import type { MeasuredCubeFrame } from './engine/projected-cube';

export const VIDEO_FACES: readonly CubeFace[] = ['U', 'R', 'F', 'D', 'L', 'B'];
const faceAtAxis = [['L', 'R'], ['F', 'B'], ['D', 'U']] as const;
const grips = CUBE_GRIP_ROTATIONS.map(rotation => {
  const perm = facePermFor(rotation);
  return { rotation, top: VIDEO_FACES.find(face => perm[face] === 'U')!,
    front: VIDEO_FACES.find(face => perm[face] === 'F')! };
});

export function playerGrip(top: CubeFace, front: CubeFace) {
  return grips.find(grip => grip.top === top && grip.front === front);
}

const timeMs = (seconds: number) => Math.round(seconds * 1000);
const GRIP_HOLD_MS = 70;
const GRIP_ERROR_DEGREES = 30;

/** Observation comes from admitted geometry. Interpolated playback samples
 * must never prove a grip change or the ordering of a turn. */
export function observeVideoSolve(scramble: string, steps: readonly MoveStep[], rows: readonly MeasuredCubeFrame[],
  fps: number, start: number, end: number) {
  const measuredTimes = new Map(rows.map(row => [row.frame, row.timestamp]));
  const movesAt = (frame: number) => timeMs(Math.max(0, (measuredTimes.get(frame) ?? frame / fps) - start));
  const commits = steps.filter(step => step.state_moves.length);
  const moves = commits.flatMap(step => step.state_moves.map(m => ({
    m: m.replaceAll('’', "'"),
    ts: movesAt(step.frame_index),
  })));
  const firstTurn = commits[0]?.frame_index ?? Infinity;
  const lastTurn = commits.at(-1)?.frame_index ?? -Infinity;
  const lastTurnTime = measuredTimes.get(lastTurn) ?? lastTurn / fps;
  const opening = rows.find(row => row.frame < firstTurn);
  const estimatedGrip = opening
    ? grips.find(grip => grip.rotation === initialGripMoves([opening], CAMERA_ORIENTATION).join(' '))!
    : undefined;
  const centers = new Map(centerColorsForScramble(scramble).map(({ axis, side, color }) => [
    faceAtAxis[axis][side > 0 ? 1 : 0], color,
  ]));
  const events: RotationEvent[] = [];
  const uncertain: { startMs: number; endMs: number }[] = [];
  const gapMs = Math.max(120, 3000 / fps);
  let anchor = opening?.pose.rotation;
  let previous = opening;
  let movement: MeasuredCubeFrame[] = [];
  let candidate: { grip: ReturnType<typeof relativeCubeGrip>; first: MeasuredCubeFrame } | undefined;

  for (const row of opening ? rows.slice(rows.indexOf(opening) + 1) : []) {
    if (!anchor || !previous) break;
    // Later frames may confirm a turn seen before the final commit. Putting
    // the cube down after the solve must not add a rotation to the solution.
    if (row.timestamp > lastTurnTime + gapMs / 1000) break;
    if (timeMs(row.timestamp - previous.timestamp) > gapMs) {
      uncertain.push({ startMs: movesAt(previous.frame), endMs: movesAt(row.frame) });
      candidate = undefined;
      movement = [];
    }
    previous = row;
    const grip = relativeCubeGrip(anchor, row.pose.rotation);
    if (grip.degrees < GRIP_ERROR_DEGREES) {
      candidate = undefined;
      movement = [];
      continue;
    }
    movement.push(row);
    if (grip.errorDegrees > GRIP_ERROR_DEGREES || !grip.moves.length) {
      candidate = undefined;
      continue;
    }
    if (candidate?.grip.basis !== grip.basis) candidate = { grip, first: row };
    if (timeMs(row.timestamp - candidate.first.timestamp) < GRIP_HOLD_MS) continue;
    const settled = candidate.first;
    if (settled.frame > lastTurn) break;
    const tMs = movesAt(settled.frame);
    const startMs = movesAt(movement[0].frame);
    const layerMotion = movement.some(sample => sample.pose.axis === grip.axis
      && sample.pose.angles.some(angle => Math.abs(angle - 90 * Math.round(angle / 90)) >= 12));
    const overlapsTurn = commits.some(step => step.frame_index >= movement[0].frame && step.frame_index <= settled.frame);
    if (grip.moves.length > 1 || (overlapsTurn && !layerMotion)) uncertain.push({ startMs, endMs: tMs });
    for (const token of grip.moves) events.push({
      token, startMs, tMs, notationMs: tMs, angleRad: token.includes('2') ? Math.PI : Math.PI / 2,
      regripOnly: !layerMotion,
    });
    anchor = grip.target;
    candidate = undefined;
    movement = [];
  }
  const throughMs = moves.at(-1)?.ts ?? 0;
  if (opening && previous && throughMs - movesAt(previous.frame) > gapMs) {
    uncertain.push({ startMs: movesAt(previous.frame), endMs: throughMs });
  }
  if (movement.length && movement[0].frame <= lastTurn && previous) {
    uncertain.push({ startMs: movesAt(movement[0].frame), endMs: movesAt(previous.frame) });
  }
  const core: CoreTrack = { frame: 'scramble', layerMotionMeasured: true, events };
  return {
    scramble, moves, timeMs: timeMs(Math.max(0, end - start)), frameMs: 1000 / fps,
    core, centers, opening, estimatedGrip, uncertain,
  };
}

export type VideoSolveObservation = ReturnType<typeof observeVideoSolve>;

/** Keep the renderer's text offsets paired with recorded frames. A compact
 * gesture can contain multiple notation tokens that share one video frame. */
export function videoNotationTimeline(result: ReconTextResult, openingMs: number) {
  const tokens = findTokenPositions(result.text);
  const inspectionLength = findTokenPositions(result.inspection).length;
  const timeline = tokens.slice(0, inspectionLength).map(token => ({ offset: token.end, timestampMs: openingMs }));
  let index = inspectionLength;
  for (const line of result.lines) {
    for (const [moveIndex, move] of formattedReconMoves(line).entries()) {
      const length = findTokenPositions(move).length;
      const range = line.moveRanges?.[moveIndex];
      if (range) {
        for (const token of tokens.slice(index, index + length)) {
          timeline.push({ offset: token.end, timestampMs: range.endTs });
        }
      }
      index += length;
    }
  }
  return timeline;
}

export async function analyzeVideoSolve(observation: VideoSolveObservation, grip: string | undefined, language: 'zh' | 'en') {
  const { scramble, moves, timeMs, frameMs, core } = observation;
  const puzzle = await getCube3();
  let raw = puzzle.defaultPattern().applyAlg(scramble);
  const checkpoints = moves.map(({ m }) => (raw = raw.applyMove(m)));
  const solved = raw.experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true });
  const method = detectSolveMethod(scramble, moves, timeMs, undefined, { allowPartial: !solved });
  const { text } = prepareReconstruction(observation, method, language, undefined, { grip, core });
  if (!text || !checkpoints.length) return undefined;

  // Match whole cubie states modulo orientation at every published cut, not
  // just the solved endpoint. A timing or direction error can affect one line
  // even when subsequent turns happen to bring the solve back on track.
  const agrees = (result: ReconTextResult) => {
    let written = puzzle.defaultPattern().applyAlg(scramble).applyAlg(result.inspection);
    for (const line of result.lines) {
      try {
        written = written.applyAlg(formatReconLine(line));
      } catch {
        return false;
      }
      const expected = checkpoints[line.toIdx];
      if (!expected || !CUBE_GRIP_ROTATIONS.some(rotation => expected.applyAlg(rotation).isIdentical(written))) return false;
    }
    return result.lines.at(-1)?.toIdx === checkpoints.length - 1;
  };

  const report = async (input: typeof text) => {
    const result = await buildReconText(input);
    const lines = result.lines.map(line => ({
      ...line,
      // A commit frame does not locate the onset of the gesture or split
      // waiting from execution. Only export a resolved stage duration.
      recognitionMs: null,
      executionMs: null,
      stepMs: line.stepMs !== null && line.stepMs >= Math.floor(frameMs) ? line.stepMs : null,
    }));
    return { ...result, lines, text: [
      ...(result.inspection ? [`${result.inspection} // insp`] : []),
      ...lines.map(formatReconLine),
    ].join('\n') };
  };
  const result = await report(text);
  if (agrees(result)) return { result, method, solved, fallback: false };
  const fixed = await report({ ...text, core: { ...core, events: [] } });
  if (agrees(fixed)) return { result: fixed, method, solved, fallback: true };
  throw new Error('Reconstruction notation does not reproduce the recognized states');
}
