'use client';

import { normalizeScramble } from '@/lib/cross-solver';
import { getRustCrossPool, poolSizeForDevice } from '@/lib/rust-cross-pool';
import type { MovesTimed, RustCrossPool } from '@/lib/rust-cross-client';
import { randomState333 } from './scramble/kociemba/random_state';
import {
  STAGE_FIXED_LENGTH,
  STAGE_ORDER,
  appendRandomFaceMove,
  countFaceMoves,
  effectiveStageSlot,
  invertFaceAlg,
  randomFaceScramble,
  solverFacesForColors,
  stageSlotCombos,
  type StageQuestion,
  type StageScrambleStyle,
  type StageTrainingConfig,
} from './stage-training';

const MAX_GENERATION_TRIES = 24;

interface SolvedFace {
  face: number;
  result: MovesTimed;
}

function slotCombo(config: StageTrainingConfig): string {
  const slot = effectiveStageSlot(config);
  if (slot === 'best') return '';
  return (stageSlotCombos(config.stage)[slot] ?? []).join(',');
}

async function solveAllSelectedFrames(
  pool: RustCrossPool,
  scramble: string,
  config: StageTrainingConfig,
): Promise<SolvedFace[]> {
  const stage = STAGE_ORDER.indexOf(config.stage);
  const faces = solverFacesForColors(config.colors);
  if (stage < 0 || faces.length === 0) return [];
  const combo = slotCombo(config);

  // Auto-slot questions only need one move enumeration: get the six scalar
  // values first, then ask the winning face for its concrete optimal path.
  if (!combo) {
    const values = await Promise.all(faces.map(async (face) => ({
      face,
      value: (await pool.solveFace(scramble, stage, face)).value,
    })));
    const best = values.reduce((winner, item) => item.value < winner.value ? item : winner);
    const result = await pool.solveMoves(scramble, stage, best.face, { extra: 0, cap: 1 });
    return [{ face: best.face, result }];
  }

  return Promise.all(faces.map(async (face) => ({
    face,
    result: await pool.solveMoves(scramble, stage, face, { extra: 0, cap: 1, combo }),
  })));
}

export async function solveStageQuestion(
  pool: RustCrossPool,
  scramble: string,
  config: StageTrainingConfig,
): Promise<StageQuestion | null> {
  const candidates = await solveAllSelectedFrames(pool, scramble, config);
  candidates.sort((a, b) => a.result.len - b.result.len);
  for (const { face, result } of candidates) {
    const item = result.sols[0];
    if (!item || !Number.isFinite(result.len) || result.len === 0xffffffff) continue;
    // Solver output starts with a view rotation. normalizeScramble conjugates
    // the body back into the fixed frame and drops that zero-HTM regrip.
    const solution = normalizeScramble(item.m);
    if (solution === null || countFaceMoves(solution) !== result.len) continue;
    return {
      scramble,
      scrambleLength: countFaceMoves(scramble),
      optimal: result.len,
      solution,
      face,
      combo: item.c,
    };
  }
  return null;
}

async function readyPool(stage: StageTrainingConfig['stage']): Promise<RustCrossPool> {
  const pool = getRustCrossPool('cross', poolSizeForDevice());
  await pool.ready;
  if (stage !== 'cross') await pool.ensureXCross();
  return pool;
}

function validQuestion(question: StageQuestion | null): question is StageQuestion {
  return !!question && question.optimal >= 1;
}

/**
 * Generate one verified question.
 *
 * `optimal` and `plus-one` are not labels inferred from construction. Each
 * short candidate is solved again against the complete selected goal union;
 * colour neutrality or a different slot can otherwise make it shorter than
 * the path it was derived from.
 */
export async function generateStageQuestion(
  config: StageTrainingConfig,
  style: StageScrambleStyle,
  rng: () => number = Math.random,
): Promise<StageQuestion> {
  const pool = await readyPool(config.stage);

  if (style === 'current' || style === 'fixed') {
    const fixedLength = STAGE_FIXED_LENGTH[config.stage];
    for (let attempt = 0; attempt < MAX_GENERATION_TRIES; attempt++) {
      // "Current" is literally the timer's existing random-state 3x3 source;
      // fixed mode deliberately uses an exact-length random-move word.
      const scramble = style === 'current' ? await randomState333() : randomFaceScramble(fixedLength, rng);
      const question = await solveStageQuestion(pool, scramble, config);
      if (validQuestion(question)) return question;
    }
    throw new Error('Unable to draw a non-solved stage question');
  }

  for (let attempt = 0; attempt < MAX_GENERATION_TRIES; attempt++) {
    const source = await solveStageQuestion(pool, await randomState333(), config);
    if (!validQuestion(source)) continue;
    const shortestScramble = invertFaceAlg(source.solution);
    if (countFaceMoves(shortestScramble) !== source.optimal) continue;

    if (style === 'optimal') {
      const verified = await solveStageQuestion(pool, shortestScramble, config);
      if (validQuestion(verified) && verified.scrambleLength === verified.optimal) return verified;
      continue;
    }

    // Try several one-turn extensions before discarding the expensive source.
    for (let extension = 0; extension < 8; extension++) {
      const candidate = appendRandomFaceMove(shortestScramble, rng);
      const verified = await solveStageQuestion(pool, candidate, config);
      if (validQuestion(verified) && verified.scrambleLength === verified.optimal + 1) return verified;
    }
  }
  throw new Error('Unable to construct the requested exact-length stage question');
}
