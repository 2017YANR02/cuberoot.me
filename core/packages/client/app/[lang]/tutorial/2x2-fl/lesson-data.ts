import { Alg } from 'cubing/alg';
import { Face } from '@cuberoot/visualcube';
import { CUBE_ORIENTATIONS } from '@/lib/cube-orientation';
import type { CourseExercise, GuidedCourseLesson } from '../components/InteractiveTutorial';
import { isWhiteFirstLayer, twoByTwoState } from '../lib/2x2-state';
import { FL_CASE_ALGS } from './case-algs';

export type FlGroup = keyof typeof FL_CASE_ALGS;
type Twist = keyof (typeof FL_CASE_ALGS)[FlGroup];
type State = ReturnType<typeof twoByTwoState>;
const text = (zh: string, en: string) => ({ zh, en });
const inverse = (alg: string) => new Alg(alg).invert().toString();
const setupBefore = (end: string, moves: string) => [end, inverse(moves)].filter(Boolean).join(' ');

export const FL_GROUPS = {
  top: {
    title: text('两角在顶层', 'Both corners on top'),
    alignment: text('用 U 把白红绿角摆在顶层左前。白绿橙角要在顶层的左后、右后或右前。如果它在底层，用 R 把它提上去。',
      'Use U to place the white–red–green corner at top front-left. The white–green–orange corner should be at top back-left, back-right or front-right. If it is on the bottom, lift it with R.'),
  },
  mixed: {
    title: text('一上一下', 'One on each layer'),
    alignment: text('先用 R 把白红绿角摆到底层右前。如果白绿橙角还在顶层，就用 U 把它摆到白红绿角正上方。',
      'First use R to place the white–red–green corner at bottom front-right. If the white–green–orange corner is on top, use U to put it directly above the white–red–green corner.'),
  },
  bottom: {
    title: text('两角在底层', 'Both corners on the bottom'),
    alignment: text('先用 R 把白红绿角摆到底层右前。如果白绿橙角也在底层，它就在底层右后。稍微抬起魔方看底面。',
      'First use R to place the white–red–green corner at bottom front-right. If the white–green–orange corner is also on the bottom, it is at bottom back-right. Tilt the cube up to inspect the underside.'),
  },
};

export const FL_TWISTS = ['0', '+', '-'] as const;
const colors = [text('白', 'White'), text('橙', 'Orange'), text('绿', 'Green')];
const topPositions = [
  text('顶层左后', 'Top back-left'),
  text('顶层右后', 'Top back-right'),
  text('顶层右前', 'Top front-right'),
];
const bottomPosition = text('底层右后', 'Bottom back-right');
const whiteDirections = {
  top: [text('朝上', 'Up'), text('朝前', 'Front'), text('朝左', 'Left')],
  right: [text('朝下', 'Down'), text('朝前', 'Front'), text('朝右', 'Right')],
};
const goal = text('复原白色第一层。检查底面四格全白，四个侧面的底排各自同色。',
  'Solve the white first layer. Check for four white stickers on the bottom and matching bottom rows on all four sides.');
const completion = text('白色第一层已复原。四个侧面的底排都已对齐，可以接 CLL。',
  'The white first layer is solved and all four side rows match. You are ready for CLL.');

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

function completesLayer(state: State, moves: string) {
  if (isWhiteFirstLayer(state)) return true;
  if (!Object.values(state).some(face => face.every(color => color === 'W'))) return false;
  return CUBE_ORIENTATIONS.some(({ value }) => value && isWhiteFirstLayer(twoByTwoState(`${moves} ${value}`)));
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

const moveNames: Record<string, ReturnType<typeof text>> = {
  U: text('顶层', 'Top'), R: text('右层', 'Right'), F: text('前层', 'Front'),
  L: text('左层', 'Left'), B: text('后层', 'Back'), x: text('绕右轴转体', 'Rotate on R axis'), y: text('绕顶轴转体', 'Rotate on U axis'),
};
function flDemoSteps(alg: string) {
  return alg.split(' ').map(notation => {
    const cue = moveNames[notation[0]];
    const turn = notation.includes('2')
      ? text('转半圈', 'turn halfway') : notation.endsWith("'")
        ? text('逆时针转四分之一圈', 'turn a quarter counterclockwise') : text('顺时针转四分之一圈', 'turn a quarter clockwise');
    return { notation, cue, detail: text(`${cue.zh}${turn.zh}。`, `${cue.en}, ${turn.en}.`) };
  });
}

function makeCase(group: FlGroup, twist: Twist, algs: readonly string[], index: number) {
  const twistIndex = FL_TWISTS.indexOf(twist);
  const ordinal = index + 1;
  const id = `${group}-${['zero', 'plus', 'minus'][twistIndex]}-${ordinal}`;
  const position = group === 'top' ? topPositions[Math.floor(index / 3)] : group === 'mixed' ? topPositions[2] : bottomPosition;
  // In DD 0 the fully solved case is omitted. The remaining DD diagrams read white, orange, green.
  const color = colors[group === 'bottom' && twist === '0' ? index + 1 : index % 3];
  const title = text(`${twist} · ${position.zh}朝${group === 'bottom' ? '下' : '上'}的${color.zh}格`,
    `${twist} · ${position.en}, ${color.en.toLowerCase()} ${group === 'bottom' ? 'down' : 'up'}`);
  const setup = canonicalSetup(algs[0]);
  const movesWithHistory = (history: readonly string[]) => [setup, ...history].join(' ');
  const exercise: CourseExercise = {
    setup, solution: algs[0], goal,
    stateKey: history => JSON.stringify(twoByTwoState(movesWithHistory(history))),
    isComplete: history => {
      const moves = movesWithHistory(history);
      return completesLayer(twoByTwoState(moves), moves);
    },
  };
  const directions = group === 'top' ? whiteDirections.top : whiteDirections.right;
  const targetPosition = group === 'top' ? text('顶层左前', 'top front-left') : text('底层右前', 'bottom front-right');
  const word = directions[twistIndex];
  const demoTitle = text('第一层公式', 'First-layer algorithm');
  const guided: GuidedCourseLesson = {
    view: FL_VIEWS[group],
    recognition: {
      progressLabel: text('识别', 'Recognize'),
      heading: text('白红绿角的白格朝哪里？', 'Which way does white face on the white–red–green corner?'),
      prompt: text(`找到${targetPosition.zh}的白红绿角，再看白格的朝向。`,
        `Find the white–red–green corner at ${targetPosition.en}, then check which way its white sticker faces.`),
      choices: directions, answer: twistIndex,
      explanation: text(`白格${word.zh}，属于 ${twist} 组。白绿橙角在${position.zh}，${color.zh}格朝${group === 'bottom' ? '下' : '上'}。`,
        `White faces ${word.en.toLowerCase()}, so use group ${twist}. The white–green–orange corner is at ${position.en.toLowerCase()} with ${color.en.toLowerCase()} facing ${group === 'bottom' ? 'down' : 'up'}.`),
    },
    algorithm: {
      progressLabel: text('归位', 'Insert'),
      heading: text('一起归位两个白角', 'Solve both white corners'),
      prompt: text('跟着箭头转动。半转可以拆成两次同方向的四分之一转。',
        'Follow the arrows. A half turn can be made as two quarter turns in the same direction.'),
      steps: flDemoSteps(algs[0]),
      demoSetup: setup, demoTitle,
      helpLabel: text('看公式演示', 'Watch the algorithm'),
      alternatives: algs.slice(1).map(alg => ({ steps: flDemoSteps(alg), demoTitle: text('备选公式', 'Alternative algorithm') })),
    },
    completion,
  };
  return { id, title, group, twist, position, color, algs, exercise, guided };
}

export const FL_CASES = Object.fromEntries((Object.keys(FL_GROUPS) as FlGroup[]).map(group => [
  group, FL_TWISTS.flatMap(twist => FL_CASE_ALGS[group][twist].map((algs, index) => makeCase(group, twist, algs, index))),
])) as Record<FlGroup, ReturnType<typeof makeCase>[]>;
export type FlCase = ReturnType<typeof makeCase>;

const exampleCase = FL_CASES.top[3];
const alignment = 'U';
const leftPairMoves = 'B F';
const alignedStart = setupBefore(exampleCase.exercise.setup, alignment);
const exampleMoves = `${leftPairMoves} ${alignment} ${exampleCase.exercise.solution}`;
export const FL_EXAMPLE = {
  setup: setupBefore(alignedStart, leftPairMoves),
  leftPairSetup: alignedStart,
  case: exampleCase,
  moves: exampleMoves,
  leftPairMoves,
  alignment,
};

const pairTitle = text('练习左侧白角对', 'Practice the left pair');
const pairGoal = text('归位底层左侧的两个白角。白朝下，蓝排在左，白蓝红角的红格朝前。',
  'Solve the two white corners at the bottom left. Keep white down, the blue row on the left and the red sticker of the white–blue–red corner in front.');
const pairExercise: CourseExercise = {
  setup: FL_EXAMPLE.setup,
  solution: leftPairMoves,
  goal: pairGoal,
  stateKey: history => JSON.stringify(twoByTwoState([FL_EXAMPLE.setup, ...history].join(' '))),
  isComplete: history => hasLeftPair(twoByTwoState([FL_EXAMPLE.setup, ...history].join(' '))),
};
const pairLesson: GuidedCourseLesson = {
  view: FL_VIEWS.top,
  recognition: {
    progressLabel: text('认块', 'Recognize'),
    heading: text('哪个颜色能把左侧的两个白角连起来？', 'Which color joins the two white corners on the left?'),
    prompt: text('看白橙蓝角和白蓝红角的侧面贴纸。', 'Look at the side stickers on the white–orange–blue and white–blue–red corners.'),
    choices: [text('橙色', 'Orange'), text('蓝色', 'Blue'), text('红色', 'Red')],
    answer: 1,
    explanation: text('两个白角都带蓝色。归位后，左面两个蓝格相邻。', 'Both corners have blue stickers. Once solved, those stickers form a row on the left.'),
  },
  algorithm: {
    progressLabel: text('拼角对', 'Build the pair'),
    heading: text('先归位左后角，再归位左前角', 'Solve the back-left corner, then the front-left corner'),
    prompt: text('跟着箭头转 B、F，把两个白角送到底层左侧。', 'Follow the arrows for B and F to place both corners at the bottom left.'),
    steps: flDemoSteps(leftPairMoves),
    demoSetup: FL_EXAMPLE.setup,
    demoTitle: pairTitle,
    helpLabel: text('看拼角对演示', 'Watch the left pair'),
  },
  completion: text('两个白格朝下，两个蓝格在左面并排。现在可以摆位剩下两个白角。',
    'Two white stickers face down, and the blue stickers form a row on the left. You can now align the other two white corners.'),
};

export const FL_LEFT_PAIR = { id: 'left-pair-practice', title: pairTitle, exercise: pairExercise, guided: pairLesson };
