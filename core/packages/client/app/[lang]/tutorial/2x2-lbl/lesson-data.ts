import { Alg } from 'cubing/alg';
import { Face } from '@cuberoot/visualcube';
import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import { ENGINE_TO_VC_FACE, netIndexOf } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { CUBE_ORIENTATIONS } from '@/lib/cube-orientation';
import type { CubeFace } from '@/lib/cube-colors';
import type { AlgStickerPlacement } from '@/components/AlgPlayer/AlgPlayer';
import type { CourseChapter, CourseExercise, GuidedCourseLesson } from '../components/InteractiveTutorial';
import { isWhiteFirstLayer as firstLayer, twoByTwoState as sampleCubeState } from '../lib/2x2-state';
import { getLblAlgGroups } from '../lbl/alg-cues';
import { LEFT as leftTrigger, LEFT_SUNE as leftFish, RIGHT_SUNE as rightFish } from '../lbl/content';

export { TWO_BY_TWO_ORIENTATION, twoByTwoState as sampleCubeState } from '../lib/2x2-state';
const rightTrigger = "R U R' U'";
const finalCornerAlg = "x' R2 D2 R' U' R D2 R' U R' x";
const yellowStart = "L' U2' L U L' U L R U2 R' U' R U' R' U";
const secondSolution = `U ${leftTrigger}`;
const thirdSolution = `U' ${rightTrigger} ${rightTrigger} ${rightTrigger}`;
const fourthSolution = `y U ${rightTrigger}`;
const bottomDone = `${yellowStart} y`;
const before = (end: string, solution: string) => `${end} ${new Alg(solution).invert()}`;
const fourthStart = before(bottomDone, fourthSolution);
const thirdStart = before(fourthStart, thirdSolution);
const secondStart = before(thirdStart, secondSolution);
const firstStart = before(secondStart, 'z');
const text = (zh: string, en: string) => ({ zh, en });
const bottomTitles = [
  text('白橙蓝角', 'White–orange–blue corner'),
  text('白蓝红角', 'White–blue–red corner'),
  text('白红绿角', 'White–red–green corner'),
  text('白绿橙角', 'White–green–orange corner'),
];

// Engine corner index order: x (right) + 2*y (up) + 4*z (front).
const cornerPieces = [
  bottomTitles[0], bottomTitles[3], text('黄橙蓝角', 'the yellow–orange–blue corner'), text('黄绿橙角', 'the yellow–green–orange corner'),
  bottomTitles[1], bottomTitles[2], text('黄蓝红角', 'the yellow–blue–red corner'), text('黄红绿角', 'the yellow–red–green corner'),
];
const cornerPositions = [
  text('底层左后', 'the bottom back-left position'), text('底层右后', 'the bottom back-right position'),
  text('顶层左后', 'the top back-left position'), text('顶层右后', 'the top back-right position'),
  text('底层左前', 'the bottom front-left position'), text('底层右前', 'the bottom front-right position'),
  text('顶层左前', 'the top front-left position'), text('顶层右前', 'the top front-right position'),
];
const cornerStickers = cornerPositions.map((_, index) => {
  const x = index % 2;
  const y = Math.floor(index / 2) % 2;
  const z = Math.floor(index / 4);
  const faces = [x ? FACE.R : FACE.L, y ? FACE.U : FACE.D, z ? FACE.F : FACE.B];
  return faces.map(face => ({ face: ENGINE_TO_VC_FACE[face] as Face, index: netIndexOf(x, y, z, face, 1, 2) }));
});
const stickerKeys = cornerStickers.map(stickers => stickers.map(({ face, index }) => `${Face[face]}${index}`));
const mutedExcept = (...visible: number[]) => stickerKeys.flatMap((stickers, index) => visible.includes(index) ? [] : stickers);
const otherCornerStickers = mutedExcept(0);
// The last corner uses the same home stickers, in the room after a y turn.
const slotsAfterY = [1, 5, 3, 7, 0, 4, 2, 6];
const facesAfterY: Record<CubeFace, CubeFace> = { U: 'U', D: 'D', F: 'L', R: 'F', B: 'R', L: 'B' };
const solvedCornerStickers = (corners: readonly number[], afterY = false) =>
  corners.flatMap(homeIndex => cornerStickers[homeIndex].map(({ face }) => {
    const homeFace = Face[face] as CubeFace;
    return { homeIndex, homeFace, placement: {
      positionIndex: afterY ? slotsAfterY[homeIndex] : homeIndex,
      face: afterY ? facesAfterY[homeFace] : homeFace,
    } };
  }));
const whiteDirections: Record<CubeFace, ReturnType<typeof text>> = {
  U: text('白格朝上', 'White faces up.'),
  D: text('白格朝下', 'White faces down.'),
  F: text('白格朝前', 'White faces forward.'),
  B: text('白格朝后', 'White faces the back.'),
  L: text('白格朝左', 'White faces left.'),
  R: text('白格朝右', 'White faces right.'),
};

export const BOTTOM_OVERVIEW = [
  { title: bottomTitles[0], goal: text('白格朝下，把白橙蓝角摆在左后。', 'Face white down and place this corner at back-left.'), setup: secondStart, corners: [0], yaw: -145 },
  { title: bottomTitles[1], goal: text('把白蓝红角放在左前，让两个蓝格相邻。', 'Insert at front-left, next to the other blue sticker.'), setup: thirdStart, corners: [0, 4], yaw: -35 },
  { title: bottomTitles[2], goal: text('把白红绿角放在右前，让两个红格相邻。', 'Insert at front-right, next to the other red sticker.'), setup: fourthStart, corners: [0, 4, 5], yaw: 35 },
  { title: bottomTitles[3], goal: text('转体把空位放到右前，放入最后一角。', 'Rotate the remaining slot to front-right and insert the last corner.'), setup: bottomDone, corners: [0, 4, 5, 1], yaw: 35 },
] as const;

export const TWO_BY_TWO_OVERVIEW = [
  {
    title: text('底层', 'First layer'),
    goal: text('四个白角归位。底面全白，四个侧面的底排也各自同色。', 'Solve all four white corners. The bottom is white, and the bottom row on each side matches.'),
    setup: yellowStart,
    stickering: 'F2L',
  },
  {
    title: text('黄面', 'Yellow face'),
    goal: text('保持底层，把顶层的四个黄格都转到上面。', 'Keep the first layer solved and turn all four yellow stickers to face up.'),
    setup: new Alg(finalCornerAlg).invert().toString(),
    stickering: 'OLL',
  },
  {
    title: text('角位置', 'Corner placement'),
    goal: text('保持顶面全黄，让顶层的四个角归位，直到六面各自同色。', 'Keep the top yellow and position the four top corners to solve all six faces.'),
    setup: '',
    stickering: 'full',
  },
] as const;

function describeWhiteCorner({ positionIndex, face }: AlgStickerPlacement) {
  const position = cornerPositions[positionIndex];
  return text(`现在在${position.zh}，${whiteDirections[face].zh}。`,
    `At ${position.en}. ${whiteDirections[face].en}`);
}

const firstCorner = (state: ReturnType<typeof sampleCubeState>) =>
  state[Face.D][2] === 'W' && state[Face.B][3] === 'O' && state[Face.L][2] === 'B';

const secondCorner = (state: ReturnType<typeof sampleCubeState>) => firstCorner(state)
  && state[Face.D][0] === 'W' && state[Face.L][3] === 'B' && state[Face.F][2] === 'R';

const thirdCorner = (state: ReturnType<typeof sampleCubeState>) => secondCorner(state)
  && state[Face.D][1] === 'W' && state[Face.F][3] === 'R' && state[Face.R][2] === 'G';

const fish = (state: ReturnType<typeof sampleCubeState>) => firstLayer(state)
  && state[Face.U].filter(color => color === 'Y').length === 1;
const yellowFace = (state: ReturnType<typeof sampleCubeState>) => firstLayer(state) && state[Face.U].every(color => color === 'Y');
const sides = [Face.F, Face.R, Face.B, Face.L];
const eyeAt = (state: ReturnType<typeof sampleCubeState>, side: Face) => state[side][0] === state[side][1];
const hasEyes = (state: ReturnType<typeof sampleCubeState>) => yellowFace(state) && sides.filter(side => eyeAt(state, side)).length === 1;
const solved = (state: ReturnType<typeof sampleCubeState>) => Object.values(state).every(face => face.every(color => color === face[0]));

function exercise(setup: string, moves: string, goal: CourseExercise['goal'],
  complete: (state: ReturnType<typeof sampleCubeState>) => boolean,
  { rotationOnly = false, fixedOrientation = rotationOnly }: { rotationOnly?: boolean; fixedOrientation?: boolean } = {}): CourseExercise {
  const orientations = fixedOrientation ? [''] : CUBE_ORIENTATIONS.map(({ value }) => value);
  return {
    setup,
    solution: moves,
    goal,
    rotationOnly,
    stateKey: history => JSON.stringify(sampleCubeState(`${setup} ${history.join(' ')}`)),
    isComplete: history => {
      const alg = `${setup} ${history.join(' ')}`;
      return orientations.some(orientation => complete(sampleCubeState(`${alg} ${orientation}`)));
    },
  };
}

const cornerViewLimit = 30;
const cornerViewTilt = cornerViewLimit * Math.PI / 180;
const frontRightView = { x: cornerViewTilt, y: -cornerViewTilt, z: 0 };
const topFace = { face: 'U', label: text('顶面', 'Top') } as const;
const rightFace = { face: 'R', label: text('右面', 'Right') } as const;
const rightInsertion = (target: ReturnType<typeof text>, demoSetup: string, solvedStickers: ReturnType<typeof solvedCornerStickers>) => ({
  progressLabel: text('右手上钩下回', 'Right-hand trigger'),
  heading: text(`用「上钩下回」还原${target.zh}`, `Solve the ${target.en.toLowerCase()} with the right-hand trigger`),
  prompt: text('照提示做右手「上钩下回」。如果角块还没归位，就重复这四步。',
    'Follow the hints for the right-hand trigger. Repeat the four moves until the corner is solved.'),
  steps: getLblAlgGroups('trigger-learning', rightTrigger).flat(),
  demoSetup,
  helpLabel: text('看看右手做法', 'Watch the right-hand trigger'),
  solvedStickers,
});
const recognizeLabel = text('观察', 'Inspect');
const alignLabel = text('摆到位', 'Align');
const applyLabel = text('做公式', 'Apply algorithm');
const watchLabel = text('看公式演示', 'Watch the algorithm');
const yellowGoal = text('保持底层复原，把四个黄格翻到顶面。', 'Keep the first layer solved and turn all four yellow stickers up.');
const fishGoal = text('保持底层复原，把顶面变成左鱼或右鱼。', 'Keep the first layer solved and make either fish.');
const fishCompletion = text('顶面只剩一个黄格，已经变成小鱼。接下来按鱼鳍方向选左鱼或右鱼。', 'Only one yellow sticker faces up. Check the fins to choose the left or right fish next.');
const fourAligned = before(before('', rightFish), rightFish);

function yellowCase(id: string, title: CourseExercise['goal'], setup: string, alignMove: string, alg: string,
  recognition: Omit<GuidedCourseLesson['recognition'], 'progressLabel'>,
  alignment: Pick<NonNullable<GuidedCourseLesson['alignment']>, 'heading' | 'prompt'>,
  isAligned: (state: ReturnType<typeof sampleCubeState>) => boolean, toFish = false) {
  const left = alg === leftFish;
  const demoTitle = left ? text('左鱼公式', 'Left Sune') : text('右鱼公式', 'Right Sune');
  const guided: GuidedCourseLesson = {
    view: { ...frontRightView, y: left ? cornerViewTilt : -cornerViewTilt },
    recognition: { ...recognition, progressLabel: recognizeLabel },
    alignment: { ...alignment, progressLabel: alignLabel, axis: 'U', showLeftThumb: toFish,
      matches: history => isAligned(sampleCubeState([setup, ...history].join(' '))) },
    algorithm: {
      progressLabel: applyLabel,
      heading: demoTitle,
      prompt: text('跟着贴纸箭头做「上、勾、下、勾、上、连拨、下」。连拨可以分两下转。',
        'Follow the arrows: up, hook, down, hook, up, double flick, down. You can do the double flick as two turns.'),
      steps: getLblAlgGroups('yellow-face', alg).flat(), demoSetup: `${setup} ${alignMove}`, demoTitle, helpLabel: watchLabel,
      showHands: 'left',
    },
    completion: toFish ? fishCompletion : text('顶面全黄，白色底层仍然复原。', 'The top is all yellow and the white first layer is still solved.'),
  };
  return { id, title, guided, exercise: exercise(setup, `${alignMove} ${alg}`, toFish ? fishGoal : yellowGoal, toFish ? fish : yellowFace) };
}

function countGreys(count: 2 | 4) {
  return {
    heading: text('顶面有几个非黄格？', 'How many top stickers are non-yellow?'),
    prompt: text('只数朝上的四格。', 'Count only the four stickers facing up.'),
    choices: [2, 3, 4].map(n => text(`${n} 格`, `${n} stickers`)),
    answer: count - 2,
    explanation: count === 2 ? text('顶面有两个非黄格，是二碰。', 'Two top stickers are non-yellow. This is the touch case.')
      : text('顶面四格都是非黄格，是四不碰。', 'All four top stickers are non-yellow. This is the avoid-yellow case.'),
  };
}

function inspectFins(left: boolean) {
  return {
    heading: text('鱼鳍朝哪一边？', 'Which way do the fins point?'),
    prompt: text('顶面唯一的黄格是鱼头。想象鱼头朝向你，看侧面的三片黄鱼鳍偏左还是偏右。',
      'The only yellow on top is the head. Imagine the head pointing toward you and check whether the three yellow fins point left or right.'),
    choices: [text('朝左', 'Left'), text('朝右', 'Right')],
    answer: left ? 0 : 1,
    explanation: left ? text('三片鱼鳍朝左，用左鱼公式。', 'The fins point left. Use left Sune.')
      : text('三片鱼鳍朝右，用右鱼公式。', 'The fins point right. Use right Sune.'),
  };
}

const cornerDemoTitle = text('角位置公式', 'Corner placement algorithm');
const cornerCues = [text('黄面朝前', 'Yellow forward'), text('上上', 'Up twice'), text('底底', 'Bottom twice'),
  text('下', 'Down'), text('右', 'Right'), text('上', 'Up'), text('底底', 'Bottom twice'),
  text('下', 'Down'), text('左', 'Left'), text('下', 'Down'), text('黄面朝上', 'Yellow up')];
const noEyesSetup = before('', `${finalCornerAlg} y ${finalCornerAlg}`);
const eyesSetup = `${noEyesSetup} ${finalCornerAlg}`;

function cornerCase(withEyes: boolean) {
  const setup = withEyes ? eyesSetup : noEyesSetup;
  const goal = withEyes ? text('让四个顶角归位，完成六面复原。', 'Position all four top corners to solve all six faces.')
    : text('保持顶面全黄和底层复原，造出一对眼。', 'Create headlights while keeping the top yellow and the first layer solved.');
  const guided: GuidedCourseLesson = {
    view: frontRightView,
    recognition: {
      progressLabel: recognizeLabel,
      heading: text('哪一面有眼？', 'Where are the headlights?'),
      prompt: text('观察四个侧面的顶排。同一面上两个顶角的贴纸同色，就叫一对眼。',
        'Check the top row of each side. A pair of matching corner stickers on the same side is called headlights.'),
      choices: [text('前面', 'Front'), text('右面', 'Right'), text('背面', 'Back'), text('左面', 'Left'), text('没有眼', 'No headlights')],
      answer: withEyes ? 2 : 4,
      explanation: withEyes ? text('背面有一对眼。接下来把有眼的一面转到右边。', 'The back has headlights. Put that side on the right next.')
        : text('四个侧面都没有眼。先做一次公式造眼。', 'There are no headlights on any side. Apply the algorithm once to make a pair.'),
    },
    alignment: withEyes ? {
      progressLabel: alignLabel, axis: 'y',
      heading: text('把眼放在右面', 'Put the headlights on the right'),
      prompt: text('左右转体，让同色的两个顶角贴纸一起朝右。', 'Rotate the entire cube until the matching top stickers face right.'),
      matches: history => {
        const state = sampleCubeState([setup, ...history].join(' '));
        return yellowFace(state) && eyeAt(state, Face.R);
      },
    } : undefined,
    algorithm: {
      progressLabel: applyLabel,
      heading: withEyes ? cornerDemoTitle : text('做公式造眼', 'Apply the algorithm to make headlights'),
      prompt: text('先转体让黄面朝前，按箭头做完口诀，最后转回黄面朝上。',
        'Rotate yellow to the front, follow the arrows through the algorithm, then rotate yellow back up.'),
      steps: finalCornerAlg.split(' ').map((notation, index) => ({ notation, cue: cornerCues[index] })),
      demoSetup: withEyes ? `${setup} y` : setup, demoTitle: cornerDemoTitle, helpLabel: watchLabel,
    },
    completion: withEyes ? text('四个顶角都已归位，六面复原。', 'All four top corners are in place. The cube is solved.')
      : text('已经造出一对眼。接下来按「有眼」的做法，把眼放右，再做一次角位置公式。', 'You have a pair now. Put the pair on the right and apply the algorithm again as shown in the Headlights lesson.'),
  };
  return { id: withEyes ? 'headlights' : 'no-headlights', title: withEyes ? text('有眼', 'Headlights') : text('无眼', 'No headlights'), guided,
    exercise: exercise(setup, withEyes ? `y ${finalCornerAlg}` : finalCornerAlg, goal, withEyes ? solved : hasEyes) };
}

export const TWO_BY_TWO_SAMPLE = [
  {
    id: 'bottom', title: TWO_BY_TWO_OVERVIEW[0].title,
    sections: [
      {
        id: 'white-orange-blue', title: bottomTitles[0],
        interaction: {
          questions: [
            { kind: 'piece', targetIndex: 0, choices: cornerPieces,
              showAnswerHint: true,
              progressLabel: text('认角块', 'Find the corner'),
              heading: text('找出白橙蓝角', 'Find the corner'),
              prompt: text('点选白、橙、蓝三格相连的角块。', 'Select the corner where white, orange, and blue meet.'),
              hint: text('看不全时，拖动魔方换个角度。', 'Drag the cube to see the other sides.') },
            { kind: 'position', targetIndex: 0, choices: cornerPositions,
              showAnswerHint: true,
              progressLabel: text('找角位', 'Find its spot'),
              heading: text('找到底层左后角位置', 'Find the bottom back-left spot'),
              prompt: text('白橙蓝角找到了。接着在魔方上点选底层左后角。', 'You found the corner. Now select the bottom back-left spot on the cube.') },
            { kind: 'placement', homeIndex: 0, homeFace: 'D', goal: { positionIndex: 0, face: 'D' }, describe: describeWhiteCorner,
              progressLabel: text('转体摆放', 'Rotate into place'),
              heading: text('把魔方摆到位', 'Rotate the cube into place'),
              prompt: text('拖动整颗魔方，把白橙蓝角摆在底层左后，白格朝下。', 'Drag the whole cube to put this corner at bottom back-left with white facing down.') },
          ],
          completion: text('下一节，让白蓝红角的蓝格和左侧这个蓝格相接。', 'In the next section, match the white–blue–red corner to this blue sticker on the left.'),
          view: { x: cornerViewTilt, y: -cornerViewTilt, z: 0 },
          orbitSnapDegrees: cornerViewLimit,
          dimStickersAfterFirstQuestion: otherCornerStickers,
          hintFacelets: true,
        },
        exercise: exercise(firstStart, 'z', text('白格朝下，把白橙蓝角摆在底面左后。', 'Point the white sticker down and place the corner at bottom back-left.'), firstCorner, { rotationOnly: true }),
      },
      {
        id: 'white-blue-red', title: bottomTitles[1],
        interaction: {
          view: { x: cornerViewTilt, y: cornerViewTilt, z: 0 },
          fixedOrientation: true,
          turnExploration: {
            opening: {
              kind: 'faces',
              progressLabel: text('试转三面', 'Try three faces'),
              heading: text('哪些面可以自由转？', 'Which faces can turn freely?'),
              prompt: text('白橙蓝角已经摆在左后。试转前面 F、顶面 U、右面 R，观察它是否留在原位。',
                'The white–orange–blue corner is at the back-left. Try turning the front (F), top (U), and right (R). Watch what happens to that corner.'),
              done: text('三面都试过了。', 'You tried all three faces.'),
              inProgress: text('白橙蓝角还在原位。', 'The white–orange–blue corner is still in place.'),
            },
            protectedCorners: text('已摆好的白橙蓝角', 'the white–orange–blue corner you placed'),
            freeFaces: [
              { face: 'F', label: text('前面', 'Front') },
              topFace, rightFace,
            ],
            mutedStickers: otherCornerStickers,
            alignment: {
              progressLabel: text('把角块移到左前', 'Move to front-left'),
              side: 'left',
              homeIndex: 4, homeFace: 'D', stickers: stickerKeys[4], goalPositions: [4, 6] as readonly number[], describe: describeWhiteCorner,
              heading: text('把白蓝红角移到左前方', 'Move the white–blue–red corner to the front-left'),
              prompt: text('转动顶层 U、右层 R 或前层 F，把白蓝红角移到左前方。顶层和底层的左前角都可以。',
                'Turn the top (U), right (R), or front (F) to move the corner to the front-left. Either the top or bottom spot is fine.'),
            },
            insertion: {
              progressLabel: text('上钩下回', 'Left-hand trigger'),
              heading: text('用「上钩下回」还原白蓝红角', 'Solve the corner with the left-hand trigger'),
              prompt: text('跟着魔方上的箭头转动。四步做完后，白蓝红角还没归位就再做一遍',
                'Follow the arrows on the cube. If the corner is still out of place after all four moves, repeat the sequence.'),
              steps: getLblAlgGroups('trigger-learning', leftTrigger).flat(),
              solvedStickers: solvedCornerStickers([0, 4]),
              demoSetup: `${secondStart} U`,
              helpLabel: text('教我上钩下回', 'Teach me the left-hand trigger'),
            },
          },
          completion: text('白橙蓝角和白蓝红角都已归位。', 'Both the white–orange–blue and white–blue–red corners are solved.'),
          orbitSnapDegrees: cornerViewLimit,
        },
        exercise: exercise(secondStart, secondSolution, text('把白蓝红角转到左前角正上方，再用左手「上钩下回」归位。', 'Align the white–blue–red corner above its slot, then insert it with the left-hand trigger.'), secondCorner, { fixedOrientation: true }),
      },
      {
        id: 'white-red-green', title: bottomTitles[2],
        interaction: {
          view: frontRightView,
          orbitSnapDegrees: cornerViewLimit,
          completion: text('前三个白角都已归位，前面的两个红格接在一起。', 'The first three white corners are solved, and the two red stickers meet at the front.'),
          turnExploration: {
            opening: {
              kind: 'faces',
              progressLabel: text('试转两面', 'Try two faces'),
              heading: text('现在还有哪些面可以自由转？', 'Which faces can still turn freely?'),
              prompt: text('前两个白角都已摆在左侧。试转顶面 U 和右面 R，观察它们是否留在原位。',
                'The first two white corners are on the left. Try turning the top (U) and right (R) and watch whether those corners stay in place.'),
              done: text('两面都试过了。', 'You tried both faces.'),
              inProgress: text('前两个白角还在原位。', 'The first two white corners are still in place.'),
            },
            protectedCorners: text('前两个已归位的角块', 'the two corners you have solved'),
            freeFaces: [topFace, rightFace],
            mutedStickers: mutedExcept(0, 4),
            alignment: {
              progressLabel: text('把角块移到右前', 'Move to front-right'),
              side: 'right',
              homeIndex: 5, homeFace: 'D', stickers: stickerKeys[5], goalPositions: [5, 7], describe: describeWhiteCorner,
              heading: text('把白红绿角移到右前方', 'Move the white–red–green corner to the front-right'),
              prompt: text('白红绿角和左前角都有红格。转顶层 U 或右层 R，把它移到右前方，顶层和底层都可以。',
                'The white–red–green corner shares red with the front-left corner. Turn U or R to bring it to either front-right spot.'),
            },
            insertion: rightInsertion(bottomTitles[2], `${thirdStart} U'`, solvedCornerStickers([0, 4, 5])),
          },
        },
        exercise: exercise(thirdStart, thirdSolution, text('把白红绿角归位，保留前两个白角。', 'Insert the white–red–green corner. Keep the first two white corners in place.'), thirdCorner),
      },
      {
        id: 'white-green-orange', title: bottomTitles[3],
        interaction: {
          view: frontRightView,
          orbitSnapDegrees: cornerViewLimit,
          completion: text('底层完成。底面全白，四个侧面的底排也各自同色。', 'The first layer is complete. The bottom is all white, and the bottom row on each side matches.'),
          turnExploration: {
            opening: {
              kind: 'rotation',
              solvedStickers: solvedCornerStickers([0, 4, 5], true),
              progressLabel: text('转体换方向', 'Rotate the cube'),
              heading: text('把右后的空位转到右前', 'Bring the back-right slot to the front-right'),
              prompt: text('最后一个空位在底层右后。向左拖过 30° 的视角边界，让魔方转体四分之一圈。',
                'The last slot is at bottom back-right. Drag left past the 30° viewing limit to rotate the cube a quarter turn.'),
              done: text('空位到了右前，接下来就能用右手「上钩下回」。', 'The slot is at front-right, ready for the right-hand trigger.'),
            },
            protectedCorners: text('已经归位的角块', 'one or more of the corners you have solved'),
            freeFaces: [topFace],
            mutedStickers: mutedExcept(0, 4, 5),
            alignment: {
              progressLabel: text('把角块移到右前', 'Move to front-right'),
              side: 'right',
              homeIndex: 1, homeFace: 'D', stickers: stickerKeys[1], goalPositions: [7], describe: describeWhiteCorner,
              heading: text('把白绿橙角移到空位上方', 'Move the white–green–orange corner above its slot'),
              prompt: text('转顶层 U，把白绿橙角移到右前空位的正上方。',
                'Turn U to bring the white–green–orange corner directly above the front-right slot.'),
            },
            insertion: rightInsertion(bottomTitles[3], `${fourthStart} y U`, solvedCornerStickers([0, 1, 4, 5], true)),
          },
        },
        exercise: exercise(fourthStart, fourthSolution, text('归位白绿橙角，完成白底和四个侧面的底排。', 'Insert the last corner to complete the white bottom and match the bottom rows on all four sides.'), firstLayer),
      },
    ],
  },
  {
    id: 'yellow', title: TWO_BY_TWO_OVERVIEW[1].title,
    sections: [
      yellowCase('right-fish', text('右鱼', 'Right fish'), `${before('', rightFish)} U`, "U'", rightFish, inspectFins(false), {
        heading: text('把右鱼的鱼头放左前', 'Place the right fish head at front-left'),
        prompt: text('转顶层 U，让唯一朝上的黄格来到左前。前面右上会看见一片黄鱼鳍。', 'Turn U until the only yellow on top is at front-left. A yellow fin will be visible at front upper-right.'),
      }, state => state[Face.U][2] === 'Y' && state[Face.F][1] === 'Y'),
      yellowCase('left-fish', text('左鱼', 'Left fish'), `${before('', leftFish)} U'`, 'U', leftFish, inspectFins(true), {
        heading: text('把左鱼的鱼头放右前', 'Place the left fish head at front-right'),
        prompt: text('转顶层 U，让唯一朝上的黄格来到右前。前面左上会看见一片黄鱼鳍。', 'Turn U until the only yellow on top is at front-right. A yellow fin will be visible at front upper-left.'),
      }, state => state[Face.U][3] === 'Y' && state[Face.F][0] === 'Y'),
      yellowCase('two-touch', text('二碰', 'Touch yellow'), yellowStart, "U'", rightFish, countGreys(2), {
        heading: text('让左拇指碰黄', 'Touch yellow with the left thumb'),
        prompt: text('看左拇指旁的前面左上格。转顶层 U，把黄色转到拇指旁。', 'Look at the front upper-left sticker beside the left thumb. Turn U to bring yellow beside the thumb.'),
      }, state => state[Face.F][0] === 'Y', true),
      yellowCase('four-no-touch', text('四不碰', 'Avoid yellow'), `${fourAligned} U`, "U'", rightFish, countGreys(4), {
        heading: text('让左拇指避开黄色', 'Keep the left thumb off yellow'),
        prompt: text('看左拇指旁的前面左上格。转顶层 U，把黄色从拇指旁转开。', 'Look at the front upper-left sticker beside the left thumb. Turn U to move yellow away from the thumb.'),
      }, state => state[Face.F][0] !== 'Y', true),
    ],
  },
  { id: 'corner-position', title: TWO_BY_TWO_OVERVIEW[2].title, sections: [cornerCase(true), cornerCase(false)] },
] as const satisfies readonly CourseChapter[];
