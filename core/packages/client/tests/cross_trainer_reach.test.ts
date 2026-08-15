/*
 * The slider only offers what the generator can actually deliver.
 *
 * `lib/cross-trainer/reach` is a measured table (see docs/cross-trainer-difficulty.md §5) and a
 * table can rot: change a sampler and a difficulty the panel still offers starts coming back
 * "can't generate that". So every offered cell is re-drawn here — the top of the range must
 * produce a case of exactly that length, and 0 must produce one too, since the low end is the
 * whole point of the conditional engine ("six-colour cross already solved" is a legitimate 0-move
 * case that a rejection sampler would never find).
 *
 * The contract tested is the PRODUCTION one, deliberately:
 *   · the budget is `GEN_BUDGET_MS`, not a laxer number — a cell that needs 8 s is a cell users
 *     watch fail, so validating at 8 s would keep CI green through exactly the regression this
 *     table exists to catch;
 *   · a failed draw may be retried, because the pool retries too (`MAX_TRIES` batches before it
 *     says "too rare"). Same budget, same number of shots a real user gets;
 *   · only combinations the panel can actually produce: a fixed slot is offered for ONE cross
 *     colour only (`GenDiffConfig` hides the slot picker as soon as the subset grows).
 *
 * This file runs in a second, isolated Vitest pass (`package.json`): its production wall-clock
 * budget must measure the generator, not scheduler stalls from 400+ concurrently loaded files.
 */

import { describe, expect, it } from 'vitest';
import {
  drawTrainerState, trainerCaps, trainerStagesOf, trainerVariants, type TrainerSpec,
} from '@/lib/cross-trainer';
import { COLOR_COUNTS, trainerDepthBounds, type SlotMode } from '@/lib/cross-trainer/reach';

/** picker 的四档底色,同档内各选项互为共轭 → 只需一个代表。 */
const SUBSET: Record<number, string> = { 1: 'W', 2: 'WY', 4: 'BGOR', 6: 'BGORWY' };
/** 线上一条打乱的预算(trainer_pool 的 GEN_BUDGET_MS)。 */
const BUDGET = 3000;
/** 取题池在报「太稀有」前会重试的批数 —— 用户实际拿到的机会数。 */
const TRIES = 3;

const draws = (spec: TrainerSpec, want: number): boolean => {
  for (let i = 0; i < TRIES; i++) {
    const r = drawTrainerState(spec, Math.random, BUDGET);
    if (r.ok && r.depth === want) return true;
  }
  return false;
};

describe('cross-trainer / offered depths', () => {
  for (const variant of trainerVariants()) {
    for (const stage of trainerStagesOf(variant)) {
      it(`${variant}/${stage}: both ends of every offered range really draw`, () => {
        const caps = trainerCaps(variant, stage)!;
        for (const colors of COLOR_COUNTS) {
          // 定槽只在单色下出现;多色时面板隐掉槽选择器,spec 也强制走最优槽。
          const modes: SlotMode[] = caps.slots && colors === 1 ? ['fixed', 'best'] : ['best'];
          for (const mode of modes) {
            const { god, allowed } = trainerDepthBounds(
              variant, stage, colors, mode, caps.range[1], caps.range[0],
            );
            const tag = `${variant}/${stage} ${colors}c/${mode}`;
            expect(allowed.length, `${tag} has something to offer`).toBeGreaterThan(0);
            expect(allowed[allowed.length - 1], `${tag} max(allowed) <= god`).toBeLessThanOrEqual(god);
            expect(allowed[0], `${tag} starts at the stage floor`).toBe(caps.range[0]);
            // 逐个抽太贵(每格 3 s 预算 × 3 次重试),抽的是边界:0(条件抽样的用武之地)、
            // 连续可抽段的最深一格,以及每个「靠枚举补上」的孤岛档。中间那些只会更容易。
            const slot = mode === 'fixed' ? 0 : ('best' as const);
            let contiguous = allowed[0];
            while (allowed.includes(contiguous + 1)) contiguous++;
            const probes = [...new Set([caps.range[0], contiguous, ...allowed.filter((d) => d > contiguous)])];
            for (const d of probes) {
              const spec: TrainerSpec = { variant, stage, colors: SUBSET[colors], slot, lo: d, hi: d };
              expect(draws(spec, d), `${tag} @${d}`).toBe(true);
            }
          }
        }
      }, 600_000);
    }
  }
});
