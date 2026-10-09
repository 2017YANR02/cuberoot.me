import { expect, it } from 'vitest';
import recording from './fixtures/pll-slice-half-turn-recording.json';
import { decodeGyroTrack } from '@cuberoot/shared/smart-cube/gyro-track';
import { buildCoreTrack } from '@cuberoot/shared/timer/reconstruct/core-track';
import { normalizeSolve, initialPoseRotation } from '@/app/[lang]/timer/_lib/reconstruct/orient';
import { computeStageSegments } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';
import { computeStepMetrics } from '@/app/[lang]/timer/_lib/reconstruct/step_metrics';
import { computeF2lSlots } from '@/app/[lang]/timer/_lib/reconstruct/f2l_slots';
import { buildReconText } from '@/app/[lang]/timer/_lib/reconstruct/recon_text';
import { applyScramble } from '@/app/[lang]/timer/_lib/cube/state';
import { applyOneToken } from '@/app/[lang]/timer/_lib/cube/apply_token';

const samples = decodeGyroTrack(recording.gyro);

  it('does not count the accumulated core half-turn a second time after Z-perm slices', async () => {
    const { scramble, moves, timeMs: totalMs, model: brand } = recording;
    const core = buildCoreTrack(samples, { brand, moves });
    const view = normalizeSolve(scramble, moves, {
      preferredRotation: initialPoseRotation(samples, brand),
    });
    const segs = computeStageSegments(scramble, moves, totalMs)!;
    const metrics = computeStepMetrics(scramble, moves, totalMs)!;
    const slots = computeF2lSlots(scramble, moves, totalMs, segs);
    const result = await buildReconText({
      scramble: view.scramble, moves: view.moves, totalMs, segs, metrics, slots, core,
      physical: { scramble, moves }, viewRotation: view.rotation,
    });
    expect(result.lines.find(line => line.kind === 'pll')?.moves.join(' '))
      .toBe("U M2' U2 M U M2' U M2' U M U'");
    const pll = result.lines.find(line => line.kind === 'pll')!;
    expect(pll.moveRanges?.map(range => range.token)).toEqual(pll.moves);
    // M2 is one displayed/clickable action, spanning the entire half-turn.
    const firstM2 = pll.moveRanges![1];
    expect(firstM2.token).toBe("M2'");
    expect(firstM2.endIdx - firstM2.startIdx + 1).toBe(4);
    expect([firstM2.ts, firstM2.endTs]).toEqual([12442, 12545]);
    const tokens = `${result.inspection} ${result.lines.flatMap(line => line.moves).join(' ')}`
      .match(/[xyzMESUDFBLRudfblr](?:2'?|')?/g) ?? [];
    let state = applyScramble(3, scramble);
    for (const token of tokens) state = applyOneToken(state, token);
    expect([state.U, state.D, state.F, state.B, state.L, state.R]
      .every(face => face.every(sticker => sticker === face[0]))).toBe(true);
  });
