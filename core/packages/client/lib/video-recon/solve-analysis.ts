import { toMoveStringStrict } from '@cuberoot/shared/alg-notation';
import { getCube3 } from '@cuberoot/shared/recon/cube3';
import { SLICE_PAIRS } from '@cuberoot/shared/recon-slice';
import { CUBE_ORIENTATIONS, orientedFaceColors } from '@cuberoot/shared/timer';
import type { CoreTrack } from '@cuberoot/shared/timer/reconstruct/core-track';
import { conjugateSequence, facePermFor, type CubeFace } from '@cuberoot/shared/timer/reconstruct/gyro-orient';
import { detectSolveMethod } from '@cuberoot/shared/timer/reconstruct/method-walk';
import { buildReconText, formattedReconMoves, formatReconLine, prepareReconstruction, type ReconTextLine, type ReconTextResult } from '@cuberoot/shared/timer/reconstruct/recon-text';
import type { RotationEvent } from '@cuberoot/shared/timer/reconstruct/rotation-detect';
import { findTokenPositions } from '@/lib/recon-alg-utils';
import { CUBE_COLOR_NAMES } from '@/lib/cube-colors';
import { centerColorsForScramble, type CubeColor } from './engine/cube-colors';
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

/** The picker uses standard colors. Convert them to the centers after this scramble. */
export function videoGripOptions(centers: ReadonlyMap<CubeFace, CubeColor>) {
  const faceByColor = new Map<string, CubeFace>(Array.from(centers, ([face, color]) => [color, face]));
  return CUBE_ORIENTATIONS.flatMap(({ value }) => {
    const colors = orientedFaceColors(value);
    const top = faceByColor.get(CUBE_COLOR_NAMES[colors.U].en);
    const front = faceByColor.get(CUBE_COLOR_NAMES[colors.F].en);
    const grip = top && front ? playerGrip(top, front) : undefined;
    return grip ? [{ value, grip }] : [];
  });
}

const timeMs = (seconds: number) => Math.round(seconds * 1000);
const GRIP_HOLD_MS = 70;
const GRIP_ERROR_DEGREES = 30;

/** Observation comes from admitted geometry. Interpolated playback samples
 * must never prove a grip change or the ordering of a turn. */
export function observeVideoSolve(scramble: string, steps: readonly MoveStep[], rows: readonly MeasuredCubeFrame[],
  fps: number, start: number, end: number, clockFps = fps) {
  const measuredTimes = new Map(rows.map(row => [row.frame, row.timestamp]));
  const movesAt = (frame: number) => timeMs(Math.max(0, (measuredTimes.get(frame) ?? frame / clockFps) - start));
  const commits = steps.filter(step => step.state_moves.length);
  const moves = commits.flatMap(step => step.state_moves.map(m => ({
    m: m.replaceAll('’', "'"),
    ts: movesAt(step.frame_index),
  })));
  const firstTurn = commits[0]?.frame_index ?? Infinity;
  const lastTurn = commits.at(-1)?.frame_index ?? -Infinity;
  const lastTurnTime = measuredTimes.get(lastTurn) ?? lastTurn / clockFps;
  const opening = rows.findLast(row => row.frame < firstTurn && row.timestamp <= start)
    ?? rows.find(row => row.frame < firstTurn);
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

/** A compact scramble can solve the written turns while rotating all of the
 * opening stickers. Require the recognized state in the standard frame. */
export async function matchVideoOpeningScramble(recognized: string, compact: string) {
  if (!compact) return recognized;
  const solved = (await getCube3()).defaultPattern();
  const opening = solved.applyAlg(recognized);
  for (const rotation of CUBE_GRIP_ROTATIONS) {
    const candidate = rotation ? `${rotation} ${compact}` : compact;
    if (solved.applyAlg(candidate).isIdentical(opening)) return candidate;
  }
  return recognized;
}

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

const COMPOUND_SLICE_WINDOW_MS = 120;
const rotationKey = (timestampMs: number, token: string) => `${timestampMs}:${token}`;

/** The outer quarter from a face + slice gesture can be merged into the
 * neighboring face turn before the slice is recognized. Recover it from
 * the same-axis half turn and keep the combined gesture's video range. */
function compactVideoSlices(line: ReconTextLine, rotationChanges: Map<string, string | null>): ReconTextLine {
  const { moveRanges, wasteGroups } = line;
  if (!moveRanges) return line;
  const ranges: typeof moveRanges = [];
  const groups: NonNullable<typeof wasteGroups> = [];
  for (let i = 0; i < moveRanges.length; i++) {
    const window = moveRanges.slice(i, i + 3);
    const rotation = window.find(move => move.rotationMs !== undefined && /^z'?$/.test(move.token));
    const face = window.find(move => /^[UDFBLR]'?$/.test(move.token));
    const half = window.find(move => /^[UDFBLR]2'?$/.test(move.token));
    const ts = Math.min(...window.map(move => move.ts));
    const endTs = Math.max(...window.map(move => move.endTs));
    if (rotation?.rotationMs !== undefined && face && half && endTs - ts <= COMPOUND_SLICE_WINDOW_MS
      && !wasteGroups?.slice(i, i + 3).some(group => group != null)) {
      const inverse = rotation.token.endsWith("'") ? rotation.token[0] : `${rotation.token}'`;
      const pair = SLICE_PAIRS.find(({ rotation, a, b }) => rotation === inverse
        && ((a === face.token && b[0] === half.token[0]) || (b === face.token && a[0] === half.token[0])));
      if (pair) {
        const outer = pair.a === face.token ? pair.b : pair.a;
        ranges.push({ token: outer + pair.slice, ts, endTs,
          startIdx: Math.min(face.startIdx, half.startIdx), endIdx: Math.max(face.endIdx, half.endIdx) });
        rotationChanges.set(rotationKey(rotation.rotationMs, rotation.token), null);
        groups.push(null);
        i += 2;
        continue;
      }
    }
    ranges.push(moveRanges[i]);
    groups.push(wasteGroups?.[i] ?? null);
  }
  return ranges.length === moveRanges.length ? line
    : { ...line, moves: ranges.map(move => move.token), moveRanges: ranges, wasteGroups: groups };
}

const Z_FRAMES = ['', 'z', 'z2', "z'"].map(facePermFor);

/** Absorb z into local gestures first. Carry any remaining z through the
 * rest of the solve as a change of frame for face, slice and rotation names. */
function rewriteVideoNotation(result: ReconTextResult) {
  const rotationChanges = new Map<string, string | null>();
  let inverseZ = 0;
  const lines = result.lines.map(source => {
    const line = compactVideoSlices(source, rotationChanges);
    if (!inverseZ && !line.moves.some(token => token.startsWith('z'))) return line;
    const entries = line.moves.flatMap((token, index) => {
      const range = line.moveRanges?.[index];
      if (/^z(?:2'?|')?$/.test(token)) {
        inverseZ = (inverseZ + (token.includes('2') ? 2 : token.endsWith("'") ? 1 : 3)) % 4;
        if (range?.rotationMs !== undefined) rotationChanges.set(rotationKey(range.rotationMs, token), null);
        return [];
      }
      if (!inverseZ) return [{ token, index }];
      const spaced = toMoveStringStrict(token).replace(/\b([rludfb])/g, face => `${face.toUpperCase()}w`);
      const mapped = conjugateSequence(spaced, Z_FRAMES[inverseZ]);
      if (mapped === null) throw new Error(`Cannot reorient video reconstruction move: ${token}`);
      const move = mapped.replaceAll(' ', '');
      if (range?.rotationMs !== undefined) rotationChanges.set(rotationKey(range.rotationMs, token), move);
      return [{ token: move, index }];
    });
    return { ...line, moves: entries.map(entry => entry.token),
      moveRanges: line.moveRanges && entries.map(({ token, index }) => ({ ...line.moveRanges![index], token })),
      wasteGroups: line.wasteGroups && entries.map(({ index }) => line.wasteGroups![index]),
    };
  });
  const rotations = result.rotations.flatMap(rotation => {
    const token = rotationChanges.get(rotationKey(rotation.tMs, rotation.token));
    return token === null ? [] : [{ ...rotation, token: token ?? rotation.token }];
  });
  return { ...result, lines, rotations };
}

function scoreOpeningGrip(result: ReconTextResult) {
  const movesFor = (line: ReconTextLine) => toMoveStringStrict(line.moves.join(' ')).split(' ').filter(Boolean);
  const frontBack = (moves: readonly string[]) => moves.filter(move => /^[fb]/i.test(move)).length;
  const lastLayer = result.lines
    .filter(line => line.key !== 'tail' && (line.kind === 'oll' || line.kind === 'pll'))
    .map(movesFor);
  const lastFormula = lastLayer.findLast(moves => moves.some(move => !/^[Uxyz](?:2'?|')?$/.test(move)));
  if (!lastFormula) return;
  return [frontBack(lastFormula), frontBack(lastLayer.flat()),
    frontBack(result.lines.filter(line => line.kind === 'f2l').flatMap(movesFor))];
}

export async function analyzeVideoSolve(observation: VideoSolveObservation, grip: string | undefined, language: 'zh' | 'en') {
  const { scramble, moves, timeMs, frameMs, core } = observation;
  const puzzle = await getCube3();
  let raw = puzzle.defaultPattern().applyAlg(scramble);
  const checkpoints = moves.map(({ m }) => (raw = raw.applyMove(m)));
  const solved = raw.experimentalIsSolved({ ignorePuzzleOrientation: true, ignoreCenterOrientation: true });
  const method = detectSolveMethod(scramble, moves, timeMs, undefined, { allowPartial: !solved });
  const prepare = (rotation: string | undefined) => prepareReconstruction(
    observation, method, language, undefined, { grip: rotation, core },
  ).text;
  const text = prepare(grip ?? observation.estimatedGrip?.rotation);
  if (!text || !checkpoints.length) return undefined;

  // Match whole cubie states modulo orientation at every published cut, not
  // just the solved endpoint. A timing or direction error can affect one line
  // even when subsequent turns happen to bring the solve back on track.
  const agrees = (result: ReconTextResult) => {
    let written = puzzle.defaultPattern().applyAlg(scramble).applyAlg(result.inspection);
    for (const line of result.lines) {
      try {
        written = written.applyAlg(toMoveStringStrict(formatReconLine(line)));
      } catch {
        return false;
      }
      const expected = checkpoints[line.toIdx];
      if (!expected || !CUBE_GRIP_ROTATIONS.some(rotation => expected.applyAlg(rotation).isIdentical(written))) return false;
    }
    return result.lines.at(-1)?.toIdx === checkpoints.length - 1;
  };

  const report = async (input: typeof text) => {
    const result = rewriteVideoNotation(await buildReconText(input));
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
  let best = agrees(result) ? result : undefined;
  if (grip === undefined && solved) {
    let score = best && scoreOpeningGrip(best);
    // The starting up face stays fixed. Keep the camera estimate on a tie.
    if (!best || (score && score.some(Boolean))) {
      const faces = facePermFor(result.inspection);
      const alternates = grips.filter(candidate => faces[candidate.top] === 'U' && faces[candidate.front] !== 'F');
      for (const candidate of alternates) {
        const input = prepare(candidate.rotation);
        if (!input) continue;
        const alternate = await report(input).catch(() => undefined);
        if (!alternate || !agrees(alternate)) continue;
        const next = scoreOpeningGrip(alternate);
        if (!next) continue;
        const previous = score;
        const difference = previous ? next.findIndex((count, i) => count !== previous[i]) : -1;
        if (!previous || (difference >= 0 && next[difference] < previous[difference])) {
          best = alternate;
          score = next;
          if (score.every(count => count === 0)) break;
        }
      }
    }
  }
  if (best) return { result: best, method, solved, fallback: false };
  const fixed = await report({ ...text, core: { ...core, events: [] } });
  if (agrees(fixed)) return { result: fixed, method, solved, fallback: true };
  throw new Error('Reconstruction notation does not reproduce the recognized states');
}
