'use client';

import { useCallback } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';
import { AllFaces, CubeData, parseAlgorithm } from '@cuberoot/visualcube';
import { PAGE_META } from '@/lib/page-meta';
import { CUBE_ORIENTATIONS } from '@/lib/cube-orientation';
import InteractiveTutorial, { type CourseChapter, type CoursePosition } from '../components/InteractiveTutorial';
import { FRONT_VIEW, Overview, Playback, Recognition, Reference, ThreeByThree, type CaseQuestion } from './CourseSections';
import {
  flipEdge, fullSolve, lastCenters, lastEdges, LAST_TWO, lastTwoSetup, notation,
  ollParity, ollSetup, oppositeCenter, ORIENTATION, pairEdges, pairSetup, pllParity, pllSetup, SCHEME,
  sameHeightSetup, sideCenters, swappedCenters, whiteCenter, type Demo,
} from './lesson-data';
import './reduction-course.css';

const centerChoices = [{ zh: '顺序正确', en: 'Order matches' }, { zh: '有两面放反', en: 'Two centers are reversed' }];
const colorQuestions: CaseQuestion[] = [
  {
    progressLabel: { zh: '对照一个角', en: 'Check a corner' },
    heading: { zh: '中心颜色跟这个角对得上吗？', en: 'Do these centers match the corner?' },
    prompt: { zh: '比较右前上角的三个贴纸，和它们各自所在面的 2×2 中心', en: 'Compare the three stickers at the top-front-right corner with the center on each of those faces.' },
    alt: { zh: '右前上角为黄、红、绿，三个中心也按相同方向排列', en: 'The corner shows yellow, red and green, in the same directions as the three centers.' },
    outlinedFacelets: [15, 16, 35], choices: centerChoices, answer: 0,
    hint: { zh: '黄贴纸朝上、红朝前、绿朝右，逐面比一下', en: 'Yellow faces up, red faces front and green faces right. Compare each face.' },
    explanation: { zh: '对。这个角显示黄上、红前、绿右，三个中心与它一致', en: 'Correct. The yellow, red and green centers agree with the corner above, in front and on the right.' },
  },
  {
    progressLabel: { zh: '找出顺序错误', en: 'Spot a center error' },
    heading: { zh: '三对相对色都对，配色就对了吗？', en: 'The opposite colors are right. Is the order right too?' },
    prompt: { zh: '还是看同一个角，检查前面中心', en: 'Use the same corner again and check the front center.' },
    alt: { zh: '右前上角的红贴纸朝前，前面中心却是橙色', en: 'The corner’s red sticker faces front, but the front center is orange.' },
    setup: swappedCenters, outlinedFacelets: [15, 16, 35], choices: centerChoices, answer: 1,
    hint: { zh: '沿着角块的红贴纸所在面看向中心', en: 'Follow the face containing the red corner sticker toward its center.' },
    explanation: { zh: '红和橙放反了，虽然它们仍在相对面。自己拼中心时，把手上魔方的角块当配色参照', en: 'Red and orange are reversed even though they are still opposite. Use a corner on your own cube as the color reference.' },
  },
];

const edgeChoices = [
  { zh: '合棱、移走、回切', en: 'Join, save and restore' },
  { zh: '先翻右前棱位', en: 'Flip front-right first' },
  { zh: '用最后两棱公式', en: 'Use the last-two-edges sequence' },
];
const edgeQuestions: CaseQuestion[] = [
  {
    progressLabel: { zh: '不同高度', en: 'Different heights' },
    heading: { zh: '两翼摆好，第一步怎么做？', en: 'The wings are in place. What comes first?' },
    prompt: { zh: '还有三条未配好，另外一条已放到顶后。观察框出的两翼', en: 'Three edges are unpaired, with the spare at top back. Look at the two outlined wings.' },
    alt: { zh: '同色两翼在左前上格和右前下格', en: 'The matching wings are at upper front-left and lower front-right.' },
    setup: pairSetup, viewportRotations: FRONT_VIEW, outlinedFacelets: [36, 43], choices: edgeChoices, answer: 0,
    hint: { zh: '检查两翼的高度，再判断有没有未配好的棱可以替下来', en: 'Check the heights of the wings, then look for an unpaired edge that can replace the new pair.' },
    explanation: { zh: '两翼一高一低，顶后也有未配好的棱可以替换。先把上内层向右切', en: 'One wing is high, one is low and the top-back edge is available. Start by slicing the upper inner layer to the right.' },
  },
  {
    progressLabel: { zh: '同一高度', en: 'Same height' },
    heading: { zh: '同色两翼都在上面一格', en: 'Both matching wings are in the upper slots' },
    prompt: { zh: '顶层还有未配好的棱。上内层一切，两翼会一起移动，怎么让它们靠拢？', en: 'There is still an unpaired edge on top. Both highlighted wings would move together with the upper slice. How do you bring them together?' },
    alt: { zh: '同色两翼占据左前和右前的两个上格', en: 'The matching wings are in the upper front-left and upper front-right slots.' },
    setup: sameHeightSetup, viewportRotations: FRONT_VIEW, outlinedFacelets: [36, 39], choices: edgeChoices, answer: 1,
    hint: { zh: '先让其中一翼换高度', en: 'First change the height of one wing.' },
    explanation: { zh: '先翻右前棱位。同色翼来到右前下格，就能按普通方法配', en: 'Flip the right slot first. The matching wing drops to the lower slot, ready for ordinary pairing.' },
  },
  {
    progressLabel: { zh: '最后两棱', en: 'Last two edges' },
    heading: { zh: '顶层已全部配好', en: 'Every edge on top is paired' },
    prompt: { zh: '只剩左前和右前两个未配好的棱位。两条上翼一组，两条下翼一组', en: 'Only front-left and front-right remain unpaired. The upper wings match each other, and so do the lower wings.' },
    alt: { zh: '两条未配好的棱在红色前面的左右两侧，上翼同色，下翼同色', en: 'The two unpaired slots flank the red front. The upper wings match, and the lower wings match.' },
    setup: lastTwoSetup, viewportRotations: FRONT_VIEW, outlinedFacelets: [36, 39, 40, 43], choices: edgeChoices, answer: 2,
    hint: { zh: '这时没有第三条未配好的棱可以替下来', en: 'There is no third unpaired edge available as a replacement.' },
    explanation: { zh: '切上内层、翻右前、回切，两条一起配好', en: 'Slice, flip front-right and restore. Both pairs come together in one sequence.' },
  },
];

const parityChoices = [
  { zh: '照三阶做', en: 'Use the 3×3 method' },
  { zh: '翻棱特殊情况', en: 'Edge-flip parity' },
  { zh: '换棱特殊情况', en: 'Edge-swap parity' },
];
const parityQuestions: CaseQuestion[] = [
  {
    progressLabel: { zh: '普通三阶', en: 'Ordinary 3×3' },
    heading: { zh: '做顶十字之前，先数一数', en: 'Count before making the top cross' },
    prompt: { zh: '只数顶色朝上的棱，角块先不看。该走哪条路线？', en: 'Count only the top-facing edge pairs. Ignore the corners for now. What do you do?' },
    alt: { zh: '只有两条棱的黄色贴纸朝上', en: 'Exactly two edge pairs have yellow facing up.' },
    setup: "F R U R' U' F'", view: 'oll', choices: parityChoices, answer: 0,
    hint: { zh: '两条朝上时，想想你熟悉的三阶顶层', en: 'Think about the top patterns you can get on a 3×3 with two edges facing up.' },
    explanation: { zh: '两条朝上是正常三阶盘面，按你熟悉的步骤翻棱', en: 'Two facing up is a normal 3×3 case. Orient the edges with your usual steps.' },
  },
  {
    progressLabel: { zh: '翻棱', en: 'Edge flip' },
    heading: { zh: '顶层缺一条棱', en: 'The top cross is one edge short' },
    prompt: { zh: '这颗已经拼好所有中心和配棱。该用哪种方法？', en: 'All centers and edges are already paired. Which solution applies?' },
    alt: { zh: '三条顶层棱黄色朝上，顶前棱的黄色朝侧面', en: 'Three top edges show yellow. The front one shows yellow on its side.' },
    setup: ollSetup, view: 'oll', choices: parityChoices, answer: 1,
    hint: { zh: '只数棱，不数角。三条顶色朝上在普通三阶中不会出现', en: 'Count edges only. Three top-facing edges cannot occur on an ordinary 3×3.' },
    explanation: { zh: '这是 OLL 翻棱特殊情况，缺的那条已经在顶前，可以直接起手', en: 'This is OLL parity. The misoriented edge is already at top front, ready for the sequence.' },
  },
  {
    progressLabel: { zh: '换棱', en: 'Edge swap' },
    heading: { zh: '顶色朝上，侧面却没对齐', en: 'The top is oriented, but the sides don’t match' },
    prompt: { zh: '四个顶角都已就位。看顶前和顶后两条棱的侧色', en: 'All four corners are in place. Compare the side colors of the front and back top edges.' },
    alt: { zh: '顶面全黄，只有顶前和顶后两条棱的侧色互换', en: 'The top is all yellow. Only the front and back top edges have their side colors exchanged.' },
    setup: pllSetup, view: 'pll', choices: parityChoices, answer: 2,
    hint: { zh: '顶色没问题，看看有几条棱需要换位置', en: 'The top color is fine. Count the edges in the wrong slots.' },
    explanation: { zh: '这是 PLL 换棱特殊情况，顶前和顶后两棱正好是公式的位置', en: 'This is PLL parity. The two opposite edges are already at top front and top back.' },
  },
];

const centerSlots = [5, 6, 9, 10];
const edgeSlots = [[1, 2], [4, 8], [7, 11], [13, 14]] as const;
function cubeFaces(alg: string) {
  const cube = new CubeData(4, Object.fromEntries(AllFaces.map(face => [face, Array<string>(16).fill(SCHEME[face])])));
  for (const move of parseAlgorithm(alg)) cube.turn(move);
  return AllFaces.map(face => cube.faces[face]);
}
const centerOrder = (faces: string[][]) => faces.map(face => face[5]).join('');
const validCenterOrders = new Set(CUBE_ORIENTATIONS.map(({ value }) => centerOrder(cubeFaces(value))));
function practiceFaces(history: readonly string[]) {
  return cubeFaces([lastTwoSetup, ...history].join(' '));
}

const edgePractice: CourseChapter['sections'][number] = {
  id: 'practice-last-two',
  title: { zh: '亲手配最后两棱', en: 'Try the last two edges' },
  observation: {
    view: { x: 0.4, y: -0.12, z: 0 },
    steps: [
      { zh: '先看左前、右前，上翼同组，下翼同组', en: 'Check front-left and front-right. The upper wings match, and the lower ones match.' },
      { zh: '点「练习本节」直接拖拧。2U 只转从上数第二层，可用提示查看下一步', en: 'Select Practice and drag to turn. 2U turns the second layer from the top. Use hints if you get stuck.' },
    ],
  },
  exercise: {
    setup: lastTwoSetup,
    solution: LAST_TWO,
    goal: { zh: '拖拧魔方，配好最后两棱并恢复中心。可以打开转动提示', en: 'Drag to pair the last two edges and restore the centers. Use a move hint if needed.' },
    stateKey: history => practiceFaces(history).map(face => face.join('')).join(''),
    isComplete: history => {
      const faces = practiceFaces(history);
      return validCenterOrders.has(centerOrder(faces))
        && faces.every(face => centerSlots.every(slot => face[slot] === face[5])
          && edgeSlots.every(([left, right]) => face[left] === face[right]));
    },
  },
};

function demoSection(id: string, demo: Demo, checkpointPause = false): CourseChapter['sections'][number] {
  return { id, title: demo.title, stage: () => <Playback demo={demo} checkpointPause={checkpointPause} /> };
}

const chapters: CourseChapter[] = [
  { id: 'intro', title: { zh: '入门', en: 'Start' }, sections: [
    { id: 'overview', title: { zh: '概览', en: 'Overview' }, index: select => <Overview select={select} /> },
    demoSection('notation', notation),
  ] },
  { id: 'centers', title: { zh: '拼中心', en: 'Centers' }, sections: [
    demoSection('first', whiteCenter),
    demoSection('opposite', oppositeCenter),
    { id: 'colors', title: { zh: '辨认中心配色', en: 'Recognize the center order' }, stage: select =>
      <Recognition sectionId="colors" questions={colorQuestions} nextSection={() => select('centers', 'sides')} /> },
    demoSection('sides', sideCenters),
    demoSection('last-centers', lastCenters),
  ] },
  { id: 'edges', title: { zh: '配棱', en: 'Edges' }, sections: [
    demoSection('pair', pairEdges),
    demoSection('same-height', flipEdge),
    demoSection('last-two', lastEdges),
    { id: 'recognition', title: { zh: '选对配棱动作', en: 'Recognize edge cases' }, stage: select =>
      <Recognition sectionId="recognition" questions={edgeQuestions} nextSection={() => select('edges', 'practice-last-two')} /> },
    edgePractice,
  ] },
  { id: 'finish', title: { zh: '三阶收尾', en: '3×3 finish' }, sections: [
    { id: 'outer', title: { zh: '只转外层', en: 'Outer turns only' }, index: select => <ThreeByThree select={select} /> },
    demoSection('oll', ollParity),
    demoSection('pll', pllParity),
    { id: 'parity-quiz', title: { zh: '辨识特殊情况', en: 'Recognize parity' }, stage: select =>
      <Recognition sectionId="parity-quiz" questions={parityQuestions} nextSection={() => select('practice')} /> },
  ] },
  { id: 'practice', title: { zh: '完整还原', en: 'Full solve' }, sections: [
    demoSection('walkthrough', fullSolve, true),
    { id: 'reference', title: { zh: '公式速查', en: 'Quick reference' }, index: select => <Reference select={select} /> },
  ] },
];

export default function Page() {
  const [{ step, section }, setLocation] = useQueryStates({ step: parseAsString, section: parseAsString });
  const chapterIndex = Math.max(0, chapters.findIndex(chapter => chapter.id === step));
  const sections = chapters[chapterIndex].sections;
  const location = { chapterIndex, sectionId: sections.find(item => item.id === section)?.id ?? sections[0].id };
  const navigate = useCallback(({ chapterIndex, sectionId }: CoursePosition, chapterChanged: boolean) => {
    const chapter = chapters[chapterIndex];
    void setLocation({ step: chapterIndex === 0 ? null : chapter.id, section: sectionId === chapter.sections[0].id ? null : sectionId },
      { history: chapterChanged ? 'push' : 'replace' });
  }, [setLocation]);

  return <InteractiveTutorial title={PAGE_META['tutorial/4x4-beginner'].title} puzzle="4x4"
    orientation={ORIENTATION} chapters={chapters} location={location} onNavigate={navigate} catalogHref="/tutorial?puzzle=4x4" />;
}
