import { Alg } from 'cubing/alg';
import { cubeMove, faceTurnToken } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { invertAlg } from '@cuberoot/shared/alg-transform';
import { mergeAdjacentMoves } from '@cuberoot/shared/alg-notation';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import { smartCubeTargetFacelets } from '@cuberoot/shared/smart-cube/cubie';
import { smartCubeScrambleProgress, type SmartCubeScrambleHint } from '@cuberoot/shared/smart-cube/scramble-hint';
import { AllFaces, CubeData, Face } from '@cuberoot/visualcube';
import { orientedFaceColors, orientCubeFacelets } from '@cuberoot/shared/timer';
import { buildCompleteDemo, buildWalkthroughCrossDemo, demoGoalReachedOnCube, middleEdgeCount, type CompleteDemo, type DemoContent } from '../complete-demo-state';
import { LBL_LESSON_RUNS, LBL_LESSON_STAGE_IDS, lessonFrame, type LblLessonStageId } from '../lesson-runs';
import { PRACTICE_GRIP, smartPracticeTurns } from '../practice-smart-cube';
import { practiceCenterAlignment } from '../practice-state';
import { YELLOW_CROSS_DEMO_SETUPS, yellowCrossCaseForPattern, type YellowCrossCase } from '../yellow-cross-demo-state';

type Text = DemoContent['text'];
export type PracticeCubeMove = (move: string, timestamp: number, facelets: string) => void;
const teachingColors = orientedFaceColors(PRACTICE_GRIP);
const tokens = (alg: string) => alg.trim().split(/\s+/).filter(Boolean);
const normalized = (alg: string): string => {
  const result = normalizeWcaScramble(alg);
  if (result === null) throw new Error('Unsupported turn in the LBL lesson');
  return result;
};

export function teachingFacelets(deviceFacelets: string): string {
  return Array.from(orientCubeFacelets(deviceFacelets, PRACTICE_GRIP), color => teachingColors[color as keyof typeof teachingColors]).join('');
}

function setCubeFacelets(cube: CubeData, facelets: string) {
  AllFaces.forEach((face, index) => {
    for (let sticker = 0; sticker < 9; sticker++) cube.faces[face][sticker] = facelets[index * 9 + sticker];
  });
}

export function lessonGoalReached(stage: LblLessonStageId, deviceFacelets: string): boolean {
  const cube = new CubeData(3);
  setCubeFacelets(cube, teachingFacelets(deviceFacelets));
  return demoGoalReachedOnCube(stage, cube);
}

export function lessonMiddleEdgesSolved(deviceFacelets: string): number {
  const cube = new CubeData(3);
  setCubeFacelets(cube, teachingFacelets(deviceFacelets));
  return middleEdgeCount(cube);
}

export function lessonStartMatcher(stage: LblLessonStageId, requestedCase?: YellowCrossCase) {
  const index = LBL_LESSON_STAGE_IDS.indexOf(stage);
  const cube = new CubeData(3);
  return (facelets: string) => {
    setCubeFacelets(cube, facelets);
    if (index > 0 && !demoGoalReachedOnCube(LBL_LESSON_STAGE_IDS[index - 1], cube)) return false;
    if (stage === 'yellow-cross' && requestedCase) {
      const pattern = [1, 3, 5, 7].map(i => cube.faces[Face.U][i] === 'U' ? '1' : '0').join('');
      return yellowCrossCaseForPattern(pattern) === requestedCase;
    }
    return !demoGoalReachedOnCube(stage, cube);
  };
}

export function lessonCanStart(stage: LblLessonStageId, facelets: string, requestedCase?: YellowCrossCase): boolean {
  return lessonStartMatcher(stage, requestedCase)(teachingFacelets(facelets));
}

export function lessonStart(stage: LblLessonStageId, variant: number, requestedCase?: YellowCrossCase) {
  const source = stage === 'yellow-cross' ? YELLOW_CROSS_DEMO_SETUPS
    : LBL_LESSON_RUNS.map(run => lessonFrame(run, stage).setup);
  const starts = source.flatMap(setup => {
    const scramble = normalized(setup);
    const deviceAlg = normalized(`${PRACTICE_GRIP} ${scramble}`);
    const facelets = smartCubeTargetFacelets(deviceAlg);
    return facelets && lessonCanStart(stage, facelets, requestedCase) ? [{ scramble, deviceAlg, facelets }] : [];
  });
  const start = starts[variant % starts.length];
  if (!start) throw new Error('Invalid LBL lesson start');
  return start;
}

export interface LessonAction {
  pose: string;
  rotation: string;
  before: string;
  after: string;
  deviceAlg: string;
  move: string;
  group: { moves: string[]; index: number; rotationIndex: number };
  content: DemoContent | undefined;
}

export interface LessonGuide {
  stage: LblLessonStageId;
  actions: LessonAction[];
  done: Text;
}

export const isLessonRotation = (move: string) => /^[xyz][2']?$/.test(move);
const canonicalRotation = (alg: string) => alg.replace(/([xyz]2)'/g, '$1');

/** Compose the taught grip separately from moves in the device's center-color frame. */
export function buildLessonGuide(stage: LblLessonStageId, startFacelets: string, deviceOpening: readonly string[]): LessonGuide {
  const setup = smartPracticeTurns(deviceOpening);
  const demo: CompleteDemo = stage === 'cross' ? buildWalkthroughCrossDemo(setup) : buildCompleteDemo(stage, setup);
  const words = tokens(canonicalRotation(new Alg(demo.alg).expand().toString()));
  const actions: LessonAction[] = [];
  let deviceCount = 0;
  let facelets = startFacelets;
  let pose = PRACTICE_GRIP;
  let rotations: string[] = [];
  for (const [index, move] of words.entries()) {
    const prefix = words.slice(0, index + 1).join(' ');
    const nextPose = `${PRACTICE_GRIP} ${canonicalRotation(invertAlg(practiceCenterAlignment(prefix)))}`.trim();
    const device = tokens(normalized(`${PRACTICE_GRIP} ${prefix}`));
    const deviceMoves = device.slice(deviceCount);
    if (isLessonRotation(move)) {
      rotations.push(move);
      pose = nextPose;
      continue;
    }
    const after = deviceMoves.reduce(cubeMove, facelets);
    const phase = demo.phases.find(candidate => candidate.start <= index && candidate.end > index);
    let groupStart = phase?.start ?? index;
    while (groupStart > 0 && isLessonRotation(words[groupStart - 1])) groupStart--;
    const indexInGroup = index - groupStart;
    const group = { moves: words.slice(groupStart, phase?.end ?? index + 1), index: indexInGroup, rotationIndex: indexInGroup - rotations.length };
    actions.push({ move, deviceAlg: deviceMoves.join(' '), pose, rotation: mergeAdjacentMoves(rotations.join(' ')),
      before: facelets, after, group, content: phase?.act });
    rotations = [];
    deviceCount = device.length;
    facelets = after;
    pose = nextPose;
  }
  if (!actions.length || !lessonGoalReached(stage, facelets)) throw new Error('Lesson guide did not reach its goal');
  return { stage, actions, done: demo.done };
}

export interface LessonProgress {
  index: number;
  facelets: string;
  wrongTurns: { before: string; turn: string }[] | null;
}

export function observeLessonTurn(guide: LessonGuide, progress: LessonProgress, facelets: string, move?: string): LessonProgress {
  if (progress.facelets === facelets) return progress;
  if (lessonGoalReached(guide.stage, facelets)) return { index: guide.actions.length, facelets, wrongTurns: [] };
  const action = guide.actions[progress.index];
  if (!action) return progress;
  if (facelets === action.after) return { index: progress.index + 1, facelets, wrongTurns: [] };
  if (matchesLessonAction(action, facelets)) return { ...progress, facelets, wrongTurns: [] };
  const wrongTurns = progress.wrongTurns;
  const restored = wrongTurns?.findIndex(entry => entry.before === facelets) ?? -1;
  if (restored >= 0) return { ...progress, facelets, wrongTurns: wrongTurns!.slice(0, restored) };
  const token = move && faceTurnToken(move);
  return { ...progress, facelets, wrongTurns: wrongTurns && token && cubeMove(progress.facelets, token) === facelets
    ? [...wrongTurns, { before: progress.facelets, turn: token }] : null };
}

export function matchesLessonAction(action: LessonAction, facelets: string): boolean {
  return facelets === action.before
    || Boolean(smartCubeScrambleProgress(action.deviceAlg, facelets, action.before));
}

export function lessonMoveHint(action: LessonAction, progress: LessonProgress): string | undefined {
  const wrong = progress.wrongTurns?.at(-1);
  if (wrong) return normalized(`${invertAlg(action.pose)} ${invertAlg(wrong.turn)}`);
  if (progress.wrongTurns === null) return undefined;
  const partial = smartCubeScrambleProgress(action.deviceAlg, progress.facelets, action.before)?.remaining[0];
  return progress.facelets !== action.before && partial && /^[URFDLB]2$/.test(action.move)
    ? normalized(`${invertAlg(action.pose)} ${partial}`) : action.move;
}

export function lessonRotationPending(action: LessonAction, progress: LessonProgress, confirmed: boolean): boolean {
  return Boolean(action.rotation && !confirmed && progress.facelets === action.before && progress.wrongTurns?.length === 0);
}

export function lessonFormulaHint(action: LessonAction, rotationPending: boolean, correction?: string): SmartCubeScrambleHint {
  const { moves, index, rotationIndex } = action.group;
  return {
    done: moves.slice(0, rotationPending ? rotationIndex : index),
    current: rotationPending ? action.rotation : action.move,
    pending: moves.slice(rotationPending ? index : index + 1),
    corrections: correction ? [correction] : undefined,
    complete: false,
  };
}

export { PRACTICE_GRIP };
