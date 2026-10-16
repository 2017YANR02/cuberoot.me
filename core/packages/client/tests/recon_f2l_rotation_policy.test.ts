import { findCheckoutRoot, readWorkbookCases } from '@/lib/recon-test-history.server';
const approvedCases = new Set(readWorkbookCases(findCheckoutRoot()!).filter(sample => sample.approved).map(sample => sample.id));
import { correctLibraryLine } from '@cuberoot/shared/timer/reconstruct/library-correction';
import cascade from './fixtures/f2l-rotation-cascade-recording.json';
import { expect, it } from 'vitest';
import recording from './fixtures/f2l-tilted-start-recording.json';
import overlappingY from './fixtures/f2l-overlapping-y-recording.json';
import unresetGrip from './fixtures/cross-unreset-orientation-recording.json';
import frontTriggers from './fixtures/f2l-front-triggers-recording.json';
import { simplifyF2lRotations } from '@cuberoot/shared/timer/reconstruct/recon-text';
import { isCross } from '@cuberoot/shared/timer/reconstruct/cfop-detect';
import { decodeGyroTrack } from '@cuberoot/shared/smart-cube/gyro-track';
import { buildCoreTrack } from '@cuberoot/shared/timer/reconstruct/core-track';
import { normalizeSolve, initialPoseRotation } from '@/app/[lang]/timer/_lib/reconstruct/orient';
import { computeStageSegments } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';
import { computeStepMetrics } from '@/app/[lang]/timer/_lib/reconstruct/step_metrics';
import { computeF2lSlots } from '@/app/[lang]/timer/_lib/reconstruct/f2l_slots';
import { buildReconText } from '@/app/[lang]/timer/_lib/reconstruct/recon_text';
import { applyScramble } from '@/app/[lang]/timer/_lib/cube/state';
import { applyOneToken } from '@/app/[lang]/timer/_lib/cube/apply_token';

it.skipIf(!approvedCases.has('E1pU5e-WEho'))('changes repeated front triggers to side triggers through inspection in E1pU5e-WEho', async () => {
  const { scramble, moves, timeMs: totalMs, model: brand } = frontTriggers;
  const samples = decodeGyroTrack(frontTriggers.gyro);
  const view = normalizeSolve(scramble, moves, { preferredRotation: initialPoseRotation(samples, brand), measuredGrip: true });
  const segs = computeStageSegments(scramble, moves, totalMs)!;
  const raw = await buildReconText({ scramble: view.scramble, moves: view.moves, totalMs, segs,
    metrics: computeStepMetrics(scramble, moves, totalMs), slots: computeF2lSlots(scramble, moves, totalMs, segs),
    core: buildCoreTrack(samples, { brand, moves }), physical: { scramble, moves }, viewRotation: view.rotation });
  const original = JSON.stringify(raw);
  const shown = simplifyF2lRotations(raw);
  expect(shown.inspection).toBe('x2');
  expect(shown.lines.filter(line => line.kind === 'f2l')[2].moves.join(' '))
    .toBe("U L U' L' U' L U' L' U L U' L'");
  let state = applyOneToken(applyScramble(3, scramble), shown.inspection);
  for (const line of shown.lines) {
    state = applyOneToken(state, line.moves.join(' '));
    if (line.kind === 'cross' || line.kind === 'f2l') {
      expect(state.D[4]).toBe('U');
      expect(isCross(state)).toBe(true);
    }
  }
  const rawEnd = applyOneToken(applyScramble(3, scramble), `${raw.inspection} ${raw.lines.flatMap(line => line.moves).join(' ')}`);
  expect(state).toEqual(rawEnd);
  expect(shown.rotations).toBe(raw.rotations);
  expect(shown.stm).toBe(raw.stm);
  expect(JSON.stringify(raw)).toBe(original);
});

it.skipIf(!approvedCases.has('jcc_J24wchw')).each([true, false])('puts the physical cross on D with measuredGrip=%s without changing the recording', async measuredGrip => {
  const { scramble, moves, timeMs: totalMs, model: brand } = unresetGrip;
  const before = JSON.stringify(unresetGrip);
  const samples = decodeGyroTrack(unresetGrip.gyro);
  const core = buildCoreTrack(samples, { brand, moves });
  const view = normalizeSolve(scramble, moves, { preferredRotation: initialPoseRotation(samples, brand), measuredGrip });
  const segs = computeStageSegments(scramble, moves, totalMs)!;
  const raw = await buildReconText({
    scramble: view.scramble, moves: view.moves, totalMs, segs,
    metrics: computeStepMetrics(scramble, moves, totalMs),
    slots: computeF2lSlots(scramble, moves, totalMs, segs),
    core, physical: { scramble, moves }, viewRotation: view.rotation,
  });
  const rawBefore = JSON.stringify(raw);
  const shown = simplifyF2lRotations(raw);
  expect(shown.crossColor).toBe('U');
  let state = applyOneToken(applyScramble(3, scramble), shown.inspection);
  expect(state.D[4]).toBe('U');
  let boundaries = 0;
  for (const line of shown.lines) {
    state = applyOneToken(state, line.moves.join(' '));
    if (line.kind === 'cross' || line.kind === 'f2l') {
      expect(state.D[4], line.key).toBe('U');
      expect(isCross(state), line.key).toBe(true);
      boundaries++;
    }
  }
  expect(boundaries).toBe(5);
  expect([state.U, state.D, state.F, state.B, state.L, state.R]
    .every(face => face.every(sticker => sticker === face[0]))).toBe(true);
  expect(JSON.stringify(raw)).toBe(rawBefore);
  expect(JSON.stringify(unresetGrip)).toBe(before);
  expect(shown.text.split('\n')[0]).toBe(`${shown.inspection} // insp`);
});

it.skipIf(!approvedCases.has('6wrK7I3TuMk'))('keeps the closing R prime before the overlapping y in share 6wrK7I3TuMk', async () => {
  const { scramble, moves, timeMs: totalMs, model: brand } = overlappingY;
  const samples = decodeGyroTrack(overlappingY.gyro);
  const core = buildCoreTrack(samples, { brand, moves });
  const turn = core!.events.find(event => event.tMs === 4288)!;
  expect(turn.tMs).toBe(4288);
  expect(turn.notationMs).toBe(4409);
  const view = normalizeSolve(scramble, moves, { preferredRotation: initialPoseRotation(samples, brand) });
  const segs = computeStageSegments(scramble, moves, totalMs)!;
  const result = await buildReconText({
    scramble: view.scramble, moves: view.moves, totalMs, segs,
    metrics: computeStepMetrics(scramble, moves, totalMs),
    slots: computeF2lSlots(scramble, moves, totalMs, segs),
    core, physical: { scramble, moves }, viewRotation: view.rotation,
  });
  expect(result.lines.filter(line => line.kind === 'f2l')[1].moves.join(' '))
    .toBe("R U' R' y U' L U' L'");
  let state = applyScramble(3, scramble);
  for (const token of `${result.inspection} ${result.lines.flatMap(line => line.moves).join(' ')}`
    .match(/[xyzMESUDFBLRudfblr](?:2'?|')?/g) ?? []) state = applyOneToken(state, token);
  expect([state.U, state.D, state.F, state.B, state.L, state.R]
    .every(face => face.every(sticker => sticker === face[0]))).toBe(true);
});

// KS6swXPv1q0: the user confirmed only y/y' body rotations. This fixture
// verifies the requested no-z F2L notation policy, not complete pose recovery.
it.each(['complete', 'live'] as const)('%s reconstruction excludes F2L z without corrupting the solve', async (mode) => {
  const { scramble, model: brand } = recording;
  const moves = mode === 'complete' ? recording.moves : recording.moves.slice(0, 20);
  const totalMs = mode === 'complete' ? recording.timeMs : moves.at(-1)!.ts;
  const samples = decodeGyroTrack(recording.gyro).filter(sample => sample.tMs <= totalMs);
  const view = normalizeSolve(scramble, moves, { preferredRotation: initialPoseRotation(samples, brand) });
  const segs = computeStageSegments(scramble, moves, totalMs)!;
  const result = await buildReconText({
    scramble: view.scramble, moves: view.moves, totalMs, segs,
    metrics: computeStepMetrics(scramble, moves, totalMs),
    slots: computeF2lSlots(scramble, moves, totalMs, segs),
    core: buildCoreTrack(samples, { brand, moves }),
    physical: { scramble, moves }, viewRotation: view.rotation,
  });
  expect(result.lines.find(line => line.kind === 'cross')?.moves.join(' ')).toBe("R B L' F' D");
  const f2lLines = mode === 'live' ? result.lines
    : result.lines.filter(line => line.kind === 'cross' || line.kind === 'f2l');
  expect(f2lLines.flatMap(line => line.moves).filter(token => /^z/.test(token))).toEqual([]);
  if (mode === 'complete') {
    let state = applyScramble(3, scramble);
    const tokens = `${result.inspection} ${result.lines.flatMap(line => line.moves).join(' ')}`
      .match(/[xyzMESUDFBLRudfblr](?:2'?|')?/g) ?? [];
    for (const token of tokens) state = applyOneToken(state, token);
    expect([state.U, state.D, state.F, state.B, state.L, state.R]
      .every(face => face.every(sticker => sticker === face[0]))).toBe(true);
  } else {
    expect(segs.f2lEndIdx).toBeNull();
  }
});

it.skipIf(!approvedCases.has('oPAYPI4Qe-I'))('keeps the cross down without rotation cascades in oPAYPI4Qe-I', async () => {
  const { scramble, moves, timeMs: totalMs, model: brand } = cascade;
  const samples = decodeGyroTrack(cascade.gyro);
  const view = normalizeSolve(scramble, moves, { preferredRotation: initialPoseRotation(samples, brand), measuredGrip: true });
  const segs = computeStageSegments(scramble, moves, totalMs)!;
  const raw = await buildReconText({ scramble: view.scramble, moves: view.moves, totalMs, segs,
    metrics: computeStepMetrics(scramble, moves, totalMs), slots: computeF2lSlots(scramble, moves, totalMs, segs),
    core: buildCoreTrack(samples, { brand, moves }), physical: { scramble, moves }, viewRotation: view.rotation });
  const original = JSON.stringify(raw);
  const pll = raw.lines.find(line => line.kind === 'pll')!;
  const corrected = await correctLibraryLine(pll, [{ alg: "(M2' U2 M U) (M2' U M2' U M) U" }]);
  expect(corrected.libraryCorrection).toBeDefined();
  const shown = simplifyF2lRotations({ ...raw, lines: raw.lines.map(line => line === pll ? corrected : line) });
  expect(shown.lines.find(line => line.kind === 'pll')!.moves.join(' ')).toBe("y M2' U2 M U M2' U M2' U M U2");

  expect(shown.lines.filter(line => line.kind === 'f2l').flatMap(line => line.moves).filter(move => /^[xz]/.test(move))).toEqual([]);
  let state = applyOneToken(applyScramble(3, scramble), shown.inspection);
  for (const line of shown.lines) {
    state = applyOneToken(state, line.moves.flatMap(token => token.match(/[RUFLDBrufldbxyzMSE]w?(?:2'?|')?/g) ?? []).join(' '));
    if (line.kind === 'cross' || line.kind === 'f2l') {
      expect(state.D[4]).toBe('U');
      expect(isCross(state)).toBe(true);
    }
  }
  expect([state.U, state.D, state.F, state.B, state.L, state.R].every(face => face.every(sticker => sticker === face[0]))).toBe(true);
  expect(shown.rotations).toBe(raw.rotations);
  expect(shown.stm).toBe(raw.stm);
  expect(JSON.stringify(raw)).toBe(original);
});
