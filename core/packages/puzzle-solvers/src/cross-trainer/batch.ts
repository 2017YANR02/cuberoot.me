import type { CubieCube } from '@cuberoot/puzzle-solvers/kociemba/cube';
import {
  drawTrainerState,
  trainerCaps,
  type TrainerSpec,
} from '@cuberoot/puzzle-solvers/cross-trainer';

export interface TrainerStateBatch {
  items: Array<{ state: CubieCube; depth: number }>;
  verdict: 'ok' | 'empty' | 'budget';
}

/** Worker-local trainer prewarm and bounded batch sampling shared by every host. */
export function createTrainerStateBatchSampler() {
  const warmed = new Set<string>();
  return (
    spec: TrainerSpec,
    count: number,
    budgetMs: number,
    rng: () => number = Math.random,
  ): TrainerStateBatch => {
    const key = `${spec.variant}/${spec.stage}`;
    if (!warmed.has(key)) {
      const caps = trainerCaps(spec.variant, spec.stage);
      if (caps) {
        drawTrainerState({
          variant: spec.variant,
          stage: spec.stage,
          colors: 'W',
          slot: 0,
          lo: caps.band[0],
          hi: caps.band[1],
        }, rng, 1);
      }
      warmed.add(key);
    }

    const items: TrainerStateBatch['items'] = [];
    let verdict: TrainerStateBatch['verdict'] = 'ok';
    const deadline = Date.now() + budgetMs;
    for (let index = 0; index < Math.max(1, count); index += 1) {
      const left = deadline - Date.now();
      const drawn = drawTrainerState(
        spec,
        rng,
        index === 0 ? budgetMs : Math.max(200, left),
      );
      if (!drawn.ok) {
        verdict = items.length ? 'ok' : drawn.reason;
        break;
      }
      items.push({ state: drawn.state, depth: drawn.depth });
      if (Date.now() > deadline) break;
    }
    return { items, verdict };
  };
}
