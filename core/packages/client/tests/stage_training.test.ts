import { describe, expect, it } from 'vitest';
import { SOLVED_FACELET, cubieToFacelet, type CubieCube } from '@/lib/cube-facelet';
import { f2lSlots, type FaceIdx } from '@/lib/cross-trainer/model';
import { applyScramble, toFaceletString } from '@/app/[lang]/timer/_lib/cube/state';
import {
  STAGE_FIXED_LENGTH,
  appendRandomFaceMove,
  countFaceMoves,
  effectiveStageSlot,
  invertFaceAlg,
  isStageTrainingSolved,
  randomFaceScramble,
  solverFacesForColors,
  stageSlotCombos,
  type StageTrainingConfig,
} from '@/app/[lang]/timer/_lib/stage-training';

const faceletsAfter = (scramble: string) => toFaceletString(applyScramble(3, scramble));

describe('stage training scramble construction', () => {
  it('locks the requested fixed lengths', () => {
    expect(STAGE_FIXED_LENGTH).toEqual({ cross: 8, xcross: 10, xxcross: 10, xxxcross: 12 });
  });

  it('generates an exact-length canonical face-turn sequence', () => {
    const values = [0.01, 0.01, 0.22, 0.45, 0.42, 0.78, 0.63, 0.12, 0.84, 0.55];
    let i = 0;
    const scramble = randomFaceScramble(12, () => values[i++ % values.length]);
    const tokens = scramble.split(' ');
    expect(tokens).toHaveLength(12);
    expect(tokens.every((token) => /^[URFDLB](?:2|')?$/.test(token))).toBe(true);
    for (let j = 1; j < tokens.length; j++) expect(tokens[j][0]).not.toBe(tokens[j - 1][0]);
    expect(randomFaceScramble(8, () => 0).split(' ')).toHaveLength(8);
  });

  it('inverts face turns and adds one non-merging HTM turn', () => {
    expect(invertFaceAlg("R U2 F'")).toBe("F U2 R'");
    const extended = appendRandomFaceMove("R U2 F'", () => 0);
    expect(countFaceMoves(extended)).toBe(4);
    expect(extended.split(' ').at(-1)?.[0]).not.toBe('F');
  });
});

describe('stage training goal semantics', () => {
  const config = (patch: Partial<StageTrainingConfig> = {}): StageTrainingConfig => ({
    stage: 'cross',
    colors: 'Y',
    slot: 'best',
    ...patch,
  });

  it('maps colour subsets to the Rust view order without duplicates', () => {
    expect(solverFacesForColors('YWORGB')).toEqual([0, 1, 2, 3, 4, 5]);
    expect(solverFacesForColors('WW?Y')).toEqual([1, 0]);
  });

  it('uses C(4,k) slot choices and rejects fixed slots for multiple colours', () => {
    expect(stageSlotCombos('xcross')).toHaveLength(4);
    expect(stageSlotCombos('xxcross')).toHaveLength(6);
    expect(stageSlotCombos('xxxcross')).toHaveLength(4);
    expect(effectiveStageSlot(config({ stage: 'xxcross', colors: 'WY', slot: 2 }))).toBe('best');
    expect(effectiveStageSlot(config({ stage: 'xxcross', colors: 'Y', slot: 2 }))).toBe(2);
    expect(effectiveStageSlot(config({ stage: 'xxcross', colors: 'Y', slot: 99 }))).toBe('best');
  });

  it('accepts every cross-family stage on solved and rejects zero selected colours', () => {
    for (const stage of ['cross', 'xcross', 'xxcross', 'xxxcross'] as const) {
      expect(isStageTrainingSolved(SOLVED_FACELET, config({ stage }))).toBe(true);
    }
    expect(isStageTrainingSolved(SOLVED_FACELET, config({ colors: '' }))).toBe(false);
  });

  it('judges the selected cross colour rather than any solved cross', () => {
    // D disturbs yellow cross while leaving white cross untouched; U is the mirror case.
    expect(isStageTrainingSolved(faceletsAfter('D'), config({ colors: 'Y' }))).toBe(false);
    expect(isStageTrainingSolved(faceletsAfter('D'), config({ colors: 'W' }))).toBe(true);
    expect(isStageTrainingSolved(faceletsAfter('U'), config({ colors: 'W' }))).toBe(false);
    expect(isStageTrainingSolved(faceletsAfter('U'), config({ colors: 'Y' }))).toBe(true);
  });

  it('counts already-solved F2L slots for X/XX/XXXCross', () => {
    // U only disturbs the opposite layer, so all four yellow-cross F2L slots stay solved.
    const state = faceletsAfter('U');
    expect(isStageTrainingSolved(state, config({ stage: 'xcross' }))).toBe(true);
    expect(isStageTrainingSolved(state, config({ stage: 'xxcross' }))).toBe(true);
    expect(isStageTrainingSolved(state, config({ stage: 'xxxcross' }))).toBe(true);
  });

  it('maps fixed BL/BR/FR/FL slots correctly in all six solver views', () => {
    // [corner, edge] for Rust slot indices BL,BR,FR,FL in views D,U,L,R,F,B.
    const expectedPieces: Array<Array<[number, number]>> = [
      [[6, 10], [7, 11], [4, 8], [5, 9]],
      [[3, 11], [2, 10], [1, 9], [0, 8]],
      [[2, 3], [6, 7], [5, 5], [1, 1]],
      [[7, 7], [3, 3], [0, 1], [4, 5]],
      [[5, 6], [4, 4], [0, 0], [1, 2]],
      [[2, 2], [3, 0], [7, 4], [6, 6]],
    ];
    const physicalFaces: FaceIdx[] = [3, 0, 4, 1, 2, 5];
    const colourKeys = ['Y', 'W', 'O', 'R', 'G', 'B'];

    for (let view = 0; view < 6; view++) {
      const allSlots = f2lSlots(physicalFaces[view]);
      for (let solverSlot = 0; solverSlot < 4; solverSlot++) {
        const keep = expectedPieces[view][solverSlot];
        const cube: CubieCube = {
          cp: [0, 1, 2, 3, 4, 5, 6, 7],
          co: Array(8).fill(0),
          ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          eo: Array(12).fill(0),
        };
        const otherCorners = allSlots.map((item) => item.corner).filter((piece) => piece !== keep[0]);
        const otherEdges = allSlots.map((item) => item.edge).filter((piece) => piece !== keep[1]);
        for (let i = 0; i < 3; i++) {
          cube.cp[otherCorners[i]] = otherCorners[(i + 1) % 3];
          cube.ep[otherEdges[i]] = otherEdges[(i + 1) % 3];
        }
        const facelets = cubieToFacelet(cube);
        expect(isStageTrainingSolved(facelets, config({
          stage: 'xcross',
          colors: colourKeys[view],
          slot: solverSlot,
        })), `view ${view}, slot ${solverSlot}`).toBe(true);
        expect(isStageTrainingSolved(facelets, config({
          stage: 'xcross',
          colors: colourKeys[view],
          slot: (solverSlot + 1) % 4,
        })), `wrong view ${view}, slot ${solverSlot}`).toBe(false);
      }
    }
  });

  it('returns false for malformed smart-cube facelets', () => {
    expect(isStageTrainingSolved('bad-state', config())).toBe(false);
  });
});
