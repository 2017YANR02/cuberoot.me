import { expect, it } from 'vitest';
import recording from './fixtures/f2l-tilted-start-recording.json';
import { decodeGyroTrack } from '@cuberoot/shared/smart-cube/gyro-track';
import { buildCoreTrack } from '@cuberoot/shared/timer/reconstruct/core-track';
import { normalizeSolve, initialPoseRotation } from '@/app/[lang]/timer/_lib/reconstruct/orient';
import { computeStageSegments } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';
import { computeStepMetrics } from '@/app/[lang]/timer/_lib/reconstruct/step_metrics';
import { computeF2lSlots } from '@/app/[lang]/timer/_lib/reconstruct/f2l_slots';
import { buildReconText } from '@/app/[lang]/timer/_lib/reconstruct/recon_text';
import { applyScramble } from '@/app/[lang]/timer/_lib/cube/state';
import { applyOneToken } from '@/app/[lang]/timer/_lib/cube/apply_token';

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
