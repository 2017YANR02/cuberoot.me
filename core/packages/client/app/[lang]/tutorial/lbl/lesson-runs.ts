import { RIGHT, CORNER_POSITION } from './content';

const MIDDLE_FRONT_MATCH = "U R U' R' U' F' U F";
const MIDDLE_RIGHT_MATCH = "R' F' R U R U' R' F";
const YELLOW_CROSS = "F R U R' U' F'";
const YELLOW_FACE_FISH = "R' U' R U' R' U2 R";
const EDGE_POSITION = "M2 U M' U2 M U M2";
export const LBL_LESSON_STAGE_IDS = [
  'daisy',
  'cross',
  'corners',
  'middle',
  'yellow-cross',
  'yellow-face',
  'corner-position',
  'edge-position',
] as const;
export type LblLessonStageId = typeof LBL_LESSON_STAGE_IDS[number];
export type LblLessonRun = {
  scramble: string;
  stages: Readonly<Record<LblLessonStageId, string>>;
};

// These source scrambles were generated offline with cubing's standard 3x3 random-state
// generator. Keep the small pool in the lesson so the selected scramble can stay fixed
// while the learner moves between steps; the later stage algorithms can be revised
// independently without adding a server-side solve request.
// Each `daisy` entry below is the offline `DaisySolverWasm` result for its scramble.
// Each `cross` entry below is a fixed beginner trace generated and validated offline
// from that daisy state: align with U, then turn the matching side 180 degrees.
const repeatAlg = (alg: string, count: number): string => Array.from({ length: count }, () => alg).join(' ');
type Regrip = '' | 'y' | 'y2' | "y'";
const regripAlg = (regrip: Regrip, alg: string): string => {
  const inverse = regrip === 'y' ? "y'" : regrip === "y'" ? 'y' : regrip;
  return [regrip, alg, inverse].filter(Boolean).join(' ');
};
const rightCornerCycle = (regrip: Regrip, count: number): string => regripAlg(regrip, repeatAlg(RIGHT, count));
export const LBL_LESSON_RUNS: readonly LblLessonRun[] = [
  {
    scramble: "U R' B2 U B L' U F' R' U L2 D' L2 B2 R2 B2 D2 F2 L2 R",
    stages: {
      daisy: "U F' L' F B R'",
      cross: 'U L2 F2 R2 B2',
      corners: [
        rightCornerCycle("y'", 1),
        "U'",
        repeatAlg(RIGHT, 3),
        "U'",
        rightCornerCycle("y'", 5),
        rightCornerCycle('y2', 5),
      ].join(' '),
      middle: [
        regripAlg("y'", MIDDLE_RIGHT_MATCH),
        regripAlg('y', MIDDLE_RIGHT_MATCH),
        regripAlg('y2', MIDDLE_RIGHT_MATCH),
      ].join(' '),
      'yellow-cross': ["U'", YELLOW_CROSS, YELLOW_CROSS].join(' '),
      'yellow-face': ['U2', YELLOW_FACE_FISH, "U'", YELLOW_FACE_FISH, 'U2', YELLOW_FACE_FISH].join(' '),
      'corner-position': ['U', CORNER_POSITION, 'U', CORNER_POSITION].join(' '),
      'edge-position': ['U', EDGE_POSITION, "U'"].join(' '),
    },
  },
  {
    scramble: "B R' U' F' L2 F' U' L' D L U2 F' L2 F' R2 B U2 F2 R2 U2 F2",
    stages: {
      daisy: 'U2 L2 R F B',
      cross: "U L2 U' R2 B2 U' F2",
      corners: [
        rightCornerCycle('y', 1),
        'U',
        repeatAlg(RIGHT, 5),
        'U2',
        rightCornerCycle("y'", 1),
        rightCornerCycle('y2', 1),
        "U'",
        rightCornerCycle('y', 5),
      ].join(' '),
      middle: [
        'U2',
        MIDDLE_RIGHT_MATCH,
        regripAlg("y'", MIDDLE_FRONT_MATCH),
        regripAlg('y', MIDDLE_FRONT_MATCH),
        "U'",
        regripAlg('y2', MIDDLE_FRONT_MATCH),
      ].join(' '),
      'yellow-cross': '',
      'yellow-face': [YELLOW_FACE_FISH, 'U', YELLOW_FACE_FISH, 'U2', YELLOW_FACE_FISH].join(' '),
      'corner-position': ['U2', CORNER_POSITION].join(' '),
      'edge-position': ['U', EDGE_POSITION, "U'"].join(' '),
    },
  },
  {
    scramble: "L2 D' R' D' R F2 B2 D F D2 R2 D2 B' R2 L2 B2 D2 R2 L U",
    stages: {
      daisy: "U D F' B R",
      cross: "U' R2 U L2 U' B2 U' F2",
      corners: [
        'U',
        repeatAlg(RIGHT, 3),
        rightCornerCycle('y2', 1),
        "U'",
        rightCornerCycle("y'", 5),
        rightCornerCycle('y', 1),
        "U'",
        rightCornerCycle('y2', 5),
        rightCornerCycle('y', 1),
      ].join(' '),
      middle: [
        regripAlg('y2', MIDDLE_FRONT_MATCH),
        "U'",
        MIDDLE_RIGHT_MATCH,
        'U2',
        regripAlg("y'", MIDDLE_FRONT_MATCH),
        "U'",
        regripAlg('y', MIDDLE_RIGHT_MATCH),
        'U2',
        regripAlg('y2', MIDDLE_FRONT_MATCH),
      ].join(' '),
      'yellow-cross': ['U2', YELLOW_CROSS, YELLOW_CROSS].join(' '),
      'yellow-face': ['U', YELLOW_FACE_FISH, "U'", YELLOW_FACE_FISH, 'U2', YELLOW_FACE_FISH].join(' '),
      'corner-position': ['U', CORNER_POSITION, CORNER_POSITION].join(' '),
      'edge-position': ["U'", EDGE_POSITION, 'U'].join(' '),
    },
  },
];

export function lessonFrame(run: LblLessonRun, stage: LblLessonStageId | 'all') {
  const index = stage === 'all' ? 0 : LBL_LESSON_STAGE_IDS.indexOf(stage);
  return {
    setup: [run.scramble, ...LBL_LESSON_STAGE_IDS.slice(0, index).map(id => run.stages[id])].join(' '),
    alg: stage === 'all' ? LBL_LESSON_STAGE_IDS.map(id => run.stages[id]).join(' ') : run.stages[stage],
  };
}
