import { cubeMove } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { invertAlg } from '@cuberoot/shared/alg-transform';
import { mergeAdjacentMoves } from '@cuberoot/shared/alg-notation';
import { cubieToFacelet } from '@cuberoot/shared/cube-facelet';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { smartCubeFixupState } from '@cuberoot/shared/smart-cube/scramble-hint';
import { MIDDLE_LEFT, MIDDLE_RIGHT } from '../content';
import { LBL_LESSON_RUNS, LBL_LESSON_STAGE_IDS, type LblLessonStageId } from '../lesson-runs';
import { YELLOW_CROSS_ACTIONS, YELLOW_CROSS_DEMO_SETUPS, type YellowCrossCase } from '../yellow-cross-demo-state';
import { buildLessonGuide, lessonCanStart, lessonGoalReached, lessonMiddleEdgesSolved, lessonStartMatcher, PRACTICE_GRIP, teachingFacelets } from './lesson-guide';

export type LessonSetupRequest = {
  stage: LblLessonStageId;
  source: string;
  opening: readonly string[];
  requestedCase?: YellowCrossCase;
  excluded?: string;
};

export type LessonSetupPlan = {
  source: string;
  facelets: string;
  deviceAlg?: string;
  prerequisite?: LblLessonStageId;
};

const faces = 'URFDLB';
const turns = Array.from(faces, face => ['', "'", '2'].map(suffix => face + suffix));
const topTurns = ['', 'U', 'U2', "U'"];
const MAX_SETUP_DEPTH = 4;

/** Stop at the first state that the live practice would accept. */
export function firstLessonSetupStart(source: string, alg: string, eligible: (state: string) => boolean) {
  let facelets = source;
  const prefix: string[] = [];
  for (const move of alg.trim().split(/\s+/).filter(Boolean)) {
    if (move.endsWith('2')) {
      for (const quarter of [move[0], `${move[0]}'`]) {
        const intermediate = cubeMove(facelets, quarter);
        if (eligible(intermediate)) return { source, facelets: intermediate, deviceAlg: [...prefix, quarter].join(' ') };
      }
    }
    facelets = cubeMove(facelets, move);
    prefix.push(move);
    if (eligible(facelets)) return { source, facelets, deviceAlg: prefix.join(' ') };
  }
}

function findNearbySetup(source: string, matches: (state: string) => boolean): string[] | undefined {
  const path: string[] = [];
  const visit = (state: string, remaining: number, previousFace: number): boolean => {
    if (remaining === 0) return matches(state);
    for (const [face, moves] of turns.entries()) {
      // Same-face turns combine. Opposite faces commute, so pick one order.
      if (face === previousFace || face === previousFace - 3) continue;
      for (const move of moves) {
        path.push(move);
        if (visit(cubeMove(state, move), remaining - 1, face)) return true;
        path.pop();
      }
    }
    return false;
  };
  for (let depth = 1; depth <= MAX_SETUP_DEPTH; depth++) {
    if (visit(source, depth, -1)) return path;
  }
}

function inverseCases(stage: LblLessonStageId, requestedCase?: YellowCrossCase): string[] {
  if (stage === 'yellow-cross') {
    if (requestedCase === 'line') return [invertAlg(YELLOW_CROSS_ACTIONS[0])];
    if (requestedCase === 'elbow') return [invertAlg(YELLOW_CROSS_ACTIONS[1])];
    if (requestedCase === 'dot') return YELLOW_CROSS_DEMO_SETUPS;
    return YELLOW_CROSS_ACTIONS.slice(0, 2).map(invertAlg);
  }
  if (stage === 'cross') return ['F2 R2 B2 L2'];
  const stageInverses = LBL_LESSON_RUNS.map(run => invertAlg(run.stages[stage]));
  if (stage !== 'middle') return stageInverses;
  const singleInsertions = [MIDDLE_LEFT, MIDDLE_RIGHT].flatMap(alg =>
    ['', 'y', 'y2', "y'"].map(rotation => `${rotation} ${invertAlg(alg)}`));
  return [...singleInsertions, ...stageInverses];
}

function prerequisiteSetup({ stage, source, opening }: LessonSetupRequest, eligible: (state: string) => boolean): LessonSetupPlan | undefined {
  const index = LBL_LESSON_STAGE_IDS.indexOf(stage);
  for (let earlier = index - 1; earlier >= 0; earlier--) {
    const prerequisite = LBL_LESSON_STAGE_IDS[earlier];
    if (!lessonCanStart(prerequisite, source)) continue;
    try {
      const guide = buildLessonGuide(prerequisite, source, opening);
      const moves: string[] = [];
      for (const action of guide.actions) {
        moves.push(action.deviceAlg);
        if (lessonGoalReached(prerequisite, action.after)) {
          const deviceAlg = moves.join(' ');
          return firstLessonSetupStart(source, deviceAlg, eligible)
            ?? { source, facelets: action.after, deviceAlg, prerequisite };
        }
      }
    } catch {
      // Try the preceding stage if this lesson cannot guide the current state.
    }
  }
}

export function planLessonSetup(request: LessonSetupRequest): LessonSetupPlan | undefined {
  const { stage, source, requestedCase, excluded } = request;
  const frame = teachingFacelets(source);
  const excludedFrame = excluded && teachingFacelets(excluded);
  const canStart = lessonStartMatcher(stage, requestedCase);
  const matches = (value: string) => value !== excludedFrame && canStart(value);
  const eligible = (value: string) => matches(teachingFacelets(value));
  if (matches(frame)) return { source, facelets: source, deviceAlg: '' };

  const completed = lessonGoalReached(stage, source);
  if (completed && stage !== 'daisy') {
    const candidates = inverseCases(stage, requestedCase).flatMap(alg => topTurns.flatMap(before =>
      topTurns.map(after => normalizeWcaScramble(`${PRACTICE_GRIP} ${before} ${alg} ${after}`) ?? '')));
    const plans = [...new Set(candidates.map(mergeAdjacentMoves))].flatMap(alg => {
      const plan = firstLessonSetupStart(source, alg, eligible);
      return plan ? [{ plan, length: plan.deviceAlg.split(' ').length,
        singleEdge: stage === 'middle' && lessonMiddleEdgesSolved(plan.facelets) === 3 }] : [];
    });
    plans.sort((a, b) => Number(b.singleEdge) - Number(a.singleEdge) || a.length - b.length);
    if (plans[0]) return plans[0].plan;
  }

  const nearby = findNearbySetup(frame, matches);
  if (nearby) return firstLessonSetupStart(source, normalizeWcaScramble(`${PRACTICE_GRIP} ${nearby.join(' ')}`)!, eligible);

  if (stage === 'yellow-cross') return;
  const previous = LBL_LESSON_STAGE_IDS[LBL_LESSON_STAGE_IDS.indexOf(stage) - 1];
  if (!completed && previous && !lessonGoalReached(previous, source)) return prerequisiteSetup(request, eligible);
}

const MAX_TOP_CROSS_TARGETS = 16;

/** Pick a short verified route to any qualifying last layer, with white still on bottom. */
export async function planDirectYellowCrossSetup(
  { source, opening, requestedCase, excluded }: LessonSetupRequest,
  solve: (facelets: string, budget: { maxDepth: number; probeMax: number }) => Promise<string>,
): Promise<LessonSetupPlan | undefined> {
  const matches = lessonStartMatcher('yellow-cross', requestedCase);
  const eligible = (state: string) => state !== excluded && matches(teachingFacelets(state));
  const targets = new Map<string, string>();
  for (const auf of topTurns) {
    for (const rotation of ['', 'y', "y'", 'y2']) {
      for (const setup of YELLOW_CROSS_DEMO_SETUPS) {
        const alg = normalizeWcaScramble(`${PRACTICE_GRIP} ${rotation} ${setup} ${auf}`);
        if (!alg) continue;
        const state = smartCubeTargetFacelets(alg);
        if (state && !targets.has(state) && eligible(state)) targets.set(state, alg);
      }
    }
  }

  let best: LessonSetupPlan | undefined;
  let bestLength = Infinity;
  const tryPath = (alg: string, target?: string) => {
    const normalized = mergeAdjacentMoves(alg);
    const moves = normalized.split(' ').filter(Boolean);
    if (target && moves.reduce(cubeMove, source) !== target) return;
    const plan = firstLessonSetupStart(source, moves.slice(0, bestLength - 1).join(' '), eligible);
    if (!plan) return;
    best = plan;
    bestLength = plan.deviceAlg.split(' ').length;
  };

  // The verified live opening already gives a path back toward solved.
  const toSolved = invertAlg(opening.join(' '));
  tryPath(toSolved);
  for (const [target, alg] of targets) tryPath(`${toSolved} ${alg}`, target);

  const shortlist = [...targets.keys()].slice(0, MAX_TOP_CROSS_TARGETS);
  for (const [index, target] of shortlist.entries()) {
    if (bestLength <= 5) break; // The setup search has already checked up to four turns.
    const relative = smartCubeFixupState(source, target);
    if (!relative) continue;
    try {
      const alg = await solve(cubieToFacelet(relative), {
        maxDepth: Math.min(21, bestLength - 1),
        probeMax: index === 0 ? 10_000 : 4_000,
      });
      const normalized = normalizeWcaScramble(alg);
      if (normalized) tryPath(normalized, target);
    } catch {
      // Exhausting one target's budget must not discard the paths already found.
    }
  }
  return best;
}
