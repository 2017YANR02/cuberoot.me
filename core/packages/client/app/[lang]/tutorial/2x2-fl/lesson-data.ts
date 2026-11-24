import { Alg } from 'cubing/alg';
import { Face } from '@cuberoot/visualcube';
import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import { engineHomeSid } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { FM_IGNORED, FM_REGULAR } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { CUBE_COLOR_LETTER_FOR_FACE, CUBE_COLOR_NAMES, type CubeFace } from '@/lib/cube-colors';
import { orientedFaceColors } from '@/lib/cube-orientation';
import { twoByTwoState } from '../lib/2x2-state';
import { TUTORIAL_STICKER_PURPLE } from '../components/tutorial-colors';
import { FL_CASE_ALGS } from './case-algs';

export type FlGroup = keyof typeof FL_CASE_ALGS;
type State = ReturnType<typeof twoByTwoState>;
const text = (zh: string, en: string) => ({ zh, en });
const inverse = (alg: string) => new Alg(alg).invert().toString();
const setupBefore = (end: string, moves: string) => [end, inverse(moves)].filter(Boolean).join(' ');

export function flPalette(orientation: string) {
  const faces = orientedFaceColors(orientation);
  const color = (side: CubeFace) => CUBE_COLOR_NAMES[faces[side]];
  const corner = (...sides: CubeFace[]) => ({
    ...text(sides.map(side => color(side).zh).join('') + '角', sides.map(side => color(side).en).join('–') + ' corner'),
    code: sides.map(side => CUBE_COLOR_LETTER_FOR_FACE[faces[side]]).join(''),
  });
  return { color, reference: corner('D', 'F', 'R'), last: corner('D', 'R', 'B'), backLeft: corner('D', 'B', 'L'), frontLeft: corner('D', 'L', 'F') };
}
export type FlPalette = ReturnType<typeof flPalette>;

export const FL_GROUPS = {
  top: { code: 'UU', title: text('两角在顶层', 'Both corners on top') },
  mixed: { code: 'UD', title: text('另一角在顶层', 'Other corner on top') },
  bottom: { code: 'DD', title: text('另一角在底层', 'Other corner on the bottom') },
};

export const FL_CHAPTERS = {
  top: { title: text('第三角块在顶层', 'Third corner on the top layer'), groups: ['top'] },
  bottom: { title: text('第三角块在底层', 'Third corner on the bottom layer'), groups: ['mixed', 'bottom'] },
} as const satisfies Record<string, { title: ReturnType<typeof text>; groups: readonly FlGroup[] }>;
export type FlChapter = keyof typeof FL_CHAPTERS;

export function flChapterTitle(chapter: FlChapter, { reference }: FlPalette) {
  return chapter === 'top' ? text(`${reference.zh}在顶层`, `${reference.code} on top`)
    : text(`${reference.zh}在底层`, `${reference.code} on the bottom`);
}

export function flChapterAlignment(chapter: FlChapter, { reference, last }: FlPalette) {
  return chapter === 'top' ? text(`用 U 把${reference.zh}摆到顶层左前。${last.zh}如果在底层，用 R 把它提到顶层。`,
    `Use U to move the ${reference.en} to top front-left. If the ${last.en} is on the bottom, lift it to the top with R.`)
    : text(`先用 R 把${reference.zh}摆到底层右前，再看${last.zh}在哪一层。`,
      `Use R to move the ${reference.en} to bottom front-right, then check which layer the ${last.en} is on.`);
}

export const FL_BOTTOM_ALIGNMENT = {
  mixed: text('用 U 把两角上下对齐', 'Use U to line up the two corners vertically'),
  bottom: text('另一角留在底层右后，从下方看底面', 'Keep the other corner at bottom back-right and look at the cube from below'),
};

export const FL_TWISTS = [
  { key: '0', id: 'zero', symbol: '0' },
  { key: '+', id: 'plus', symbol: '+' },
  { key: '-', id: 'minus', symbol: '−' },
] as const;
export type FlTwist = (typeof FL_TWISTS)[number];
const lastFaces = ['D', 'B', 'R'] as const;
const topPositions = [
  text('顶层左后', 'Top back-left'),
  text('顶层右后', 'Top back-right'),
  text('顶层右前', 'Top front-right'),
];
const bottomPosition = text('底层右后', 'Bottom back-right');
const bottomColorDirections = {
  top: { '0': text('朝上', 'up'), '+': text('朝前', 'forward'), '-': text('朝左', 'left') },
  right: { '0': text('朝下', 'down'), '+': text('朝前', 'forward'), '-': text('朝右', 'right') },
};

export function flSectionId(group: FlGroup, twist: FlTwist) {
  return `${group}-${twist.id}`;
}

export function flBottomColorDirection(group: FlGroup, twist: FlTwist) {
  return bottomColorDirections[group === 'top' ? 'top' : 'right'][twist.key];
}

export function flSectionHeading(group: FlGroup, twist: FlTwist, palette: FlPalette, includeCorner = false) {
  const direction = flBottomColorDirection(group, twist);
  const bottom = palette.color('D');
  return text(`${twist.symbol} · ${includeCorner ? palette.reference.zh + '的' : ''}${bottom.zh}格${direction.zh}`,
    `${twist.symbol} · ${capitalize(bottom.en)} faces ${direction.en}${includeCorner ? ' on the ' + palette.reference.en : ''}`);
}

const capitalize = (word: string) => word[0].toUpperCase() + word.slice(1);

export const FL_VIEWS = {
  top: { x: Math.PI / 6, y: Math.PI / 6, z: 0 },
  mixed: { x: Math.PI / 6, y: -Math.PI / 6, z: 0 },
  bottom: { x: -Math.PI / 6, y: -Math.PI / 6, z: 0 },
};

export function hasLeftPair(state: State) {
  return [0, 2].every(index => state[Face.D][index] === 'W')
    && [2, 3].every(index => state[Face.L][index] === 'B')
    && state[Face.F][2] === 'R' && state[Face.B][3] === 'O';
}

function canonicalSetup(alg: string) {
  const undo = inverse(alg);
  for (const end of ['', 'y', 'y2', "y'"]) {
    // Keep an unsolved last layer so the demonstration stops at the FL goal.
    const setup = ["R U R' U R U2 R'", end, undo].filter(Boolean).join(' ');
    if (hasLeftPair(twoByTwoState(setup))) return setup;
  }
  throw new Error(`Cannot align the left pair for ${alg}`);
}

function makeCase(group: FlGroup, twist: FlTwist, algs: readonly string[], index: number) {
  const sectionId = flSectionId(group, twist);
  const id = `${sectionId}-${index + 1}`;
  const position = group === 'top' ? topPositions[Math.floor(index / 3)] : group === 'mixed' ? topPositions[2] : bottomPosition;
  // In DD 0 the fully solved case is omitted. The remaining DD diagrams read white, orange, green.
  const face = lastFaces[group === 'bottom' && twist.key === '0' ? index + 1 : index % 3];
  return { id, sectionId, group, position, face, algs, setup: canonicalSetup(algs[0]) };
}

export const FL_CASES = Object.fromEntries((Object.keys(FL_GROUPS) as FlGroup[]).map(group => [
  group, FL_TWISTS.flatMap(twist => FL_CASE_ALGS[group][twist.key].map((algs, index) => makeCase(group, twist, algs, index))),
])) as Record<FlGroup, ReturnType<typeof makeCase>[]>;
export type FlCase = ReturnType<typeof makeCase>;

const layerQuizCases = [FL_CASES.top, [...FL_CASES.mixed, ...FL_CASES.bottom]];
const quizTopTurns = ['', 'U', 'U2', "U'"];
const quizRightTurns = [['', 'R', 'R2', "R'"], ['', "R'"]];

export function randomFlLayerQuizSetup(randomBelow = (limit: number) => Math.floor(Math.random() * limit)) {
  // Draw the reference layer first so top and bottom are equally likely.
  const layer = randomBelow(layerQuizCases.length);
  const cases = layerQuizCases[layer];
  const rightTurns = quizRightTurns[layer];
  // R does not move the top case's UFL reference. For bottom cases, R'
  // moves it from DFR to DBR. U can then vary the upper corners' slots.
  return [
    cases[randomBelow(cases.length)].setup,
    rightTurns[randomBelow(rightTurns.length)],
    quizTopTurns[randomBelow(quizTopTurns.length)],
  ].filter(Boolean).join(' ');
}

export function flCaseGroups(chapter: FlChapter, twist: FlTwist) {
  return FL_CHAPTERS[chapter].groups.map(group => ({
    group,
    cases: FL_CASES[group].filter(item => item.sectionId === flSectionId(group, twist)),
  }));
}

export function flCaseLabel({ position, face, group }: FlCase, palette: FlPalette) {
  const color = palette.color(face);
  return text(`${position.zh} · ${color.zh}格朝${group === 'bottom' ? '下' : '上'}`,
    `${position.en} · ${capitalize(color.en)} ${group === 'bottom' ? 'down' : 'up'}`);
}

export const FL_WRG_HOME = 5;
export const FL_WGO_HOME = 1;
export const FL_REFERENCE_STICKERS = [FACE.D, FACE.F, FACE.R].map(face => engineHomeSid(FL_WRG_HOME, face, 2));
export const FL_LAST_STICKERS = [FACE.D, FACE.B, FACE.R].map(face => engineHomeSid(FL_WGO_HOME, face, 2));
export const FL_PURPLE_LAST = Object.fromEntries(FL_LAST_STICKERS.map(sticker => [sticker, TUTORIAL_STICKER_PURPLE]));
export const flFirstLayerMask = () => (piece: number) => flCornerLayer(piece) === 'D' ? FM_REGULAR : FM_IGNORED;

export function flCornerLayer(position: number) {
  return (position & 2) === 0 ? 'D' : 'U';
}

// Drag notation preserves the number of quarter turns and their direction,
// including moves such as U2' and U3 that are equivalent to shorter notation.
export function isFlPracticeTurn(move: string, face?: 'U' | 'R') {
  return /^[UR]\d*'?$/.test(move) && (face === undefined || move[0] === face);
}

export function flRecognitionGroup(wrg: number, wgo: number): FlGroup | undefined {
  if (wrg === 6 && flCornerLayer(wgo) === 'U') return 'top'; // UFL
  if (wrg === 5) return flCornerLayer(wgo) === 'U' ? 'mixed' : 'bottom'; // DFR
}

export function flTwistFromStickerFace(chapter: FlChapter, face: CubeFace): FlTwist | undefined {
  const faces: readonly CubeFace[] = chapter === 'top' ? ['U', 'F', 'L'] : ['D', 'F', 'R'];
  return FL_TWISTS[faces.indexOf(face)];
}

export function flAlignedTwist(group: FlGroup, reference: { positionIndex: number; face: CubeFace }, last: number) {
  if (flRecognitionGroup(reference.positionIndex, last) !== group) return;
  if (group === 'mixed' && last !== 7) return; // UFR, directly above the reference corner.
  if (group === 'bottom' && last !== 1) return; // DBR.
  return flTwistFromStickerFace(group === 'top' ? 'top' : 'bottom', reference.face);
}

// Build examples backward from real formula cases. Both D examples use the same
// R turn, but it sends the other corner to opposite layers.
export const FL_RECOGNITION_EXAMPLES = ([
  { group: 'top', moves: ['U', 'R'], end: FL_CASES.top[6] },
  { group: 'mixed', moves: ['R', 'U'], end: FL_CASES.mixed[3] },
  { group: 'bottom', moves: ['R'], end: FL_CASES.bottom[5] },
] as const).map(example => ({ ...example, setup: setupBefore(example.end.setup, example.moves.join(' ')) }));

export function createFlAlignmentDemo(group: FlGroup, randomBelow = (limit: number) => Math.floor(Math.random() * limit)) {
  const example = FL_RECOGNITION_EXAMPLES.find(item => item.group === group)!;
  if (group !== 'top') return example;
  const moves = [quizTopTurns[1 + randomBelow(quizTopTurns.length - 1)], ...example.moves.slice(1)];
  return { ...example, moves, setup: setupBefore(example.end.setup, moves.join(' ')) };
}

export function randomFlAlignmentRound(chapter: FlChapter, previousPose?: number,
  randomBelow = (limit: number) => Math.floor(Math.random() * limit)) {
  const groups = FL_CHAPTERS[chapter].groups;
  const group = groups[randomBelow(groups.length)];
  const offsetCount = chapter === 'top' ? quizTopTurns.length - 1 : 1;
  const poseCount = offsetCount * FL_TWISTS.length;
  const draw = randomBelow(poseCount - Number(previousPose !== undefined));
  const pose = previousPose !== undefined && draw >= previousPose ? draw + 1 : draw;
  const twist = FL_TWISTS[pose % FL_TWISTS.length];
  const cases = FL_CASES[group].filter(item => item.sectionId === flSectionId(group, twist));
  const { setup } = cases[randomBelow(cases.length)];
  // A U offset samples the three non-target top slots. For the bottom
  // chapter DBR is the only non-target bottom slot with the left pair solved.
  const moves = group === 'top' ? [quizRightTurns[0][randomBelow(quizRightTurns[0].length)], quizTopTurns[1 + Math.floor(pose / FL_TWISTS.length)]]
    : group === 'mixed' ? [quizTopTurns[1 + randomBelow(quizTopTurns.length - 1)], "R'"] : ["R'"];
  return { setup: [setup, ...moves].filter(Boolean).join(' '), pose };
}

export function randomFlFourthCornerSetup(chapter: FlChapter, twist: FlTwist,
  randomBelow = (limit: number) => Math.floor(Math.random() * limit)) {
  const group = chapter === 'top' ? 'top' : 'mixed';
  const section = flSectionId(group, twist);
  const cases = FL_CASES[group].filter(item => item.sectionId === section
    && (group !== 'top' || item.position === topPositions[2]));
  const { setup } = cases[randomBelow(cases.length)];
  // From UFR, either right-layer offset puts corner 4 on the bottom.
  // In the bottom chapter, a UD setup lets U move corner 4 without disturbing corner 3.
  const offsets = group === 'top' ? ["R'", 'R2'] : quizTopTurns.slice(1);
  return [setup, offsets[randomBelow(offsets.length)]].join(' ');
}

export function randomFlTwistQuizSetup(chapter: FlChapter, previousTwist: FlTwist,
  randomBelow = (limit: number) => Math.floor(Math.random() * limit)) {
  const twists = FL_TWISTS.filter(twist => twist.key !== previousTwist.key);
  const groups = flCaseGroups(chapter, twists[randomBelow(twists.length)]);
  const { cases } = groups[randomBelow(groups.length)];
  return cases[randomBelow(cases.length)].setup;
}

const exampleCase = FL_CASES.top[3];
const alignment = 'U';
const leftPairMoves = 'B F';
const alignedStart = setupBefore(exampleCase.setup, alignment);
const exampleMoves = `${leftPairMoves} ${alignment} ${exampleCase.algs[0]}`;
export const FL_EXAMPLE = {
  setup: setupBefore(alignedStart, leftPairMoves),
  leftPairSetup: alignedStart,
  case: exampleCase,
  moves: exampleMoves,
  leftPairMoves,
  alignment,
};
