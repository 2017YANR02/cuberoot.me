import { Alg } from 'cubing/alg';
import catalog from './alg-snapshot.json';
import type { NonstandardIntroScene } from './nonstandard-intro';
import { CUBE_COLOR_NAMES } from '@/lib/cube-colors';
import { orientedFaceColors } from '@/lib/cube-orientation';

export const NONSTANDARD_TREATMENT_TITLE = { zh: '处理非标', en: 'Handling non-standard cases' };

const t = catalog.cases.find(item => item.name === 'T')!;
const a = catalog.cases.find(item => item.name === 'A+')!;
const moves = Array.from(new Alg(t.algs[0][0].alg).expand().childAlgNodes(), move => move.toString());
const prefix = moves.slice(0, -3).join(' ');
const insertion = moves.slice(-3).join(' ');
// The same relative T pattern at FL, with the original FR pair identities.
// This is not a whole-cube rotation: centers and the solved cross stay fixed.
// With FL brought to the viewer's right front, these are the same hand moves
// as T's prefix: y' (U' R' F R F') y in the original fixed cube coordinates.
const adjacentPrefix = "U' F' L F L'";
const adjacentSetup = `${a.setup} U ${new Alg(adjacentPrefix).invert().toString()}`;
const standardEnd = `${t.setup} ${prefix}`;
const adjacentEnd = `${adjacentSetup} ${adjacentPrefix}`;
const normalReference = {
  setup: t.setup,
  label: { zh: 'T', en: 'T' },
  alg: t.algs[0][0].alg,
  segments: [prefix, insertion],
};

/** Fixed, editable shots: recognize the relative pattern, transform, align, insert. */
const scenes: NonstandardIntroScene[] = [
  {
    caption: { zh: 'F2L · T\n标态 F2L 与公式完全一致', en: 'F2L · T\nThe standard F2L case matches the algorithm exactly' },
    setup: t.setup, alg: '', duration: 6500, highlight: [],
    bubble: { zh: '和公式库中的状态完全一样', en: 'Exactly the same case as in the algorithm library' },
  },
  {
    caption: { zh: '按公式做前段转化\n得到熟悉的 A+', en: 'Perform the first part of the algorithm\nThis gives us the familiar A+' },
    setup: t.setup, alg: prefix, duration: 6500, highlight: [], continuePrevious: true,
    moveStart: 2000, moveGap: 450, activeReferenceSegment: 0,
  },
  {
    caption: { zh: '棱角组合好了，也已经对准目标槽\n接上 A+ 的三步，完成还原', en: 'The pair is joined and aligned with its target slot\nFinish with the three moves of A+' },
    setup: standardEnd, alg: insertion, duration: 6000, highlight: [], continuePrevious: true,
    moveStart: 2000, moveGap: 500, activeReferenceSegment: 1,
  },
  {
    caption: { zh: '现在来观察这个状态\n按照定义，它属于非标态', en: 'Now look at this state\nBy definition, it is a non-standard case' },
    setup: adjacentSetup, alg: '', duration: 8500, highlight: [], fadePairTransition: true,
    viewTurn: { from: 0, to: Math.PI / 2, start: 600, duration: 2600 },
    bubbleTarget: 'edge', bubbleAt: 3400,
  },
  {
    caption: { zh: '棱角的相对位置和 T 相同\n前段按公式处理', en: 'The edge and corner have the same relative positions as in T\nFollow the first part of the algorithm' },
    setup: adjacentSetup, alg: '', duration: 6500, highlight: [],
    continuePrevious: true, viewYaw: Math.PI / 2,
    bubble: { zh: '棱角相对位置与公式相同', en: 'The pair has the same relative positions as in the algorithm' },
  },
  {
    caption: { zh: '保持这个朝向\n在右前方做 T 的前段', en: 'Keep this orientation\nPerform T’s first part at the front right' },
    setup: adjacentSetup, alg: adjacentPrefix, duration: 6500, highlight: [], continuePrevious: true,
    viewYaw: Math.PI / 2, moveStart: 2000, moveGap: 450, activeReferenceSegment: 0,
  },
  {
    caption: { zh: '棱角已经组合好了\n把它们真正的目标槽转回右前方', en: 'The edge and corner are now paired\nBring their own target slot back to the front right' },
    setup: adjacentEnd, alg: '', duration: 6500, highlight: [], continuePrevious: true,
    viewTurn: { from: Math.PI / 2, to: 0, start: 1200, duration: 2600 },
  },
  {
    caption: { zh: '和 A+ 相比\n只差一步顶面调整', en: 'Compared with A+\nOnly one U-layer adjustment remains' },
    setup: adjacentEnd, alg: '', duration: 5500, highlight: [], continuePrevious: true,
  },
  {
    caption: { zh: '转动 U′，对准 A+ 的起始朝向', en: 'Turn U′ to align the pair for A+' },
    setup: adjacentEnd, alg: "U'", duration: 4500, highlight: [], continuePrevious: true,
    moveStart: 1800,
  },
  {
    caption: { zh: '再用熟悉的三步，把棱角送回自己的 FR 槽', en: 'Use the familiar three moves to insert the pair into its own FR slot' },
    setup: `${adjacentEnd} U'`, alg: insertion, duration: 6000, highlight: [], continuePrevious: true,
    moveStart: 1800, moveGap: 500, activeReferenceSegment: 1,
  },
  {
    caption: {
      zh: '识别 case，主要看目标棱块与角块的相对位置\n记忆公式，重点记住状态的转化过程\n中间灵活插入顶层调整，应对非标',
      en: 'Recognize cases by the relative positions of the target edge and corner\nLearn algorithms by remembering how one state becomes another\nAdd U-layer adjustments along the way to handle non-standard cases',
    },
    setup: `${adjacentEnd} U' ${insertion}`, alg: '', duration: 6500, highlight: [], continuePrevious: true,
    comparisonSummary: { standard: t.setup, nonstandard: `${adjacentSetup} y'`, paired: standardEnd, unaligned: adjacentEnd },
  },
];

// Keep timing stable even during still shots: changing it remounts the renderer.
export function nonstandardTreatmentScenes(orientation: string): readonly NonstandardIntroScene[] {
  const colors = orientedFaceColors(orientation);
  const front = CUBE_COLOR_NAMES[colors.F], right = CUBE_COLOR_NAMES[colors.R];
  return scenes.map(scene => ({
    ...scene, moveDuration: 800, reference: normalReference,
    bubble: scene.bubbleTarget === 'edge' ? {
      zh: `${front.zh}${right.zh}棱块位于其他槽内，非标态`,
      en: `The ${front.en}-${right.en} edge is in another slot: a non-standard case`,
    } : scene.bubble,
  }));
}
