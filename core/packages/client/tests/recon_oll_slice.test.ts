import { describe, expect, it } from 'vitest';
import recording from './fixtures/oll-slice-recording.json';
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

describe('recorded OLL slice followed by a closing wide turn', () => {
  it('recovers the reported S, closes the frame within OLL, and still solves', async () => {
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
    expect(result.lines.find(line => line.kind === 'oll')?.moves.join(' '))
      .toBe("U S R U R' U' R' F R f'");
    expect(result.lines.find(line => line.key === 'slot-BL')?.moves.join(' '))
      .toBe("U2 FS' R U' R' S U' F'");
    expect(result.lines.find(line => line.kind === 'pll')?.moves.join(' '))
      .toBe("U R' F R B' z L' F L2 D L' D' L' F' L2 D L' B F'");
    // Independent cube-state check: presentation changes must preserve the solve.
    const tokens = `${result.inspection} ${result.lines.flatMap(line => line.moves).join(' ')}`
      .match(/[xyzMESUDFBLRudfblr](?:2'?|')?/g) ?? [];
    let state = applyScramble(3, scramble);
    for (const token of tokens) state = applyOneToken(state, token);
    // A reconstructed solve may finish in a different whole-cube orientation.
    expect([state.U, state.D, state.F, state.B, state.L, state.R]
      .every(face => face.every(sticker => sticker === face[0])))
      .toBe(true);
  });

  it('does not invent the missing slice from gyro alone or a different-axis pair', () => {
    const baseline = buildCoreTrack(samples, { brand: recording.model });
    const wrongAxis = recording.moves.map((move, i) => (
      i === 37 ? { ...move, m: 'R' } : i === 38 ? { ...move, m: "L'" } : move
    ));
    const wrong = buildCoreTrack(samples, { brand: recording.model, moves: wrongAxis });
    const ollEvents = (track: ReturnType<typeof buildCoreTrack>) => track!.events
      .filter(event => event.tMs >= 14007 && event.tMs < 18543);
    expect(ollEvents(baseline)).toEqual([]);
    expect(ollEvents(wrong)).toEqual([]);
  });
});
