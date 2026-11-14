import { practiceState } from '../../lib/practice-state';
import catalog from './alg-snapshot.json';
import type { LocalizedText } from './chapters';
import { CUBE_COLOR_NAMES } from '@/lib/cube-colors';
import { orientedFaceColors } from '@/lib/cube-orientation';

export interface NonstandardIntroScene {
  caption: LocalizedText;
  setup: string;
  alg: string;
  duration: number;
  highlight: readonly string[];
  hidePair?: boolean;
  crossOnly?: boolean;
  result?: 'standard' | 'nonstandard';
  leftView?: boolean;
  moveStart?: number;
  moveGap?: number;
  moveDuration?: number;
  showBottom?: boolean;
  bottomTilt?: number;
  revealLeft?: boolean;
  flashPair?: boolean;
  fadeInPair?: boolean;
  /** The preceding shot ends at this shot's setup and camera angle. */
  continuePrevious?: boolean;
  beats?: readonly {
    at: number;
    caption: LocalizedText;
    label?: LocalizedText;
    highlight: readonly string[];
    pulse?: boolean;
    hideCorner?: boolean;
    hideEdge?: boolean;
  }[];
}

const edge = ['F5', 'R3'];
const corner = ['D2', 'F8', 'R6'];
const pair = [...edge, ...corner];
export { pair as NONSTANDARD_INTRO_PAIR_STICKERS };
export const TERMINOLOGY_OUTRO_MS = 3400;
const topSetup = "R U R'";
const setupOf = (name: string) => catalog.cases.find(item => item.name === name)!.setup;
const homeStickers = [...'URFDLB'].flatMap(face => Array.from({ length: 9 }, (_, index) => `${face}${index}`));

/** Highlight occupied positions, rather than the target pieces' solved identities. */
function stickersAt(setup: string, positions: readonly string[]): string[] {
  const state = (JSON.parse(practiceState(homeStickers, setup)) as string[][]).flat();
  return positions.map(position => state[homeStickers.indexOf(position)]);
}

const topAndSlot = [...Array.from({ length: 9 }, (_, index) => `U${index}`).filter(sticker => sticker !== 'U4'),
  ...[...'FRBL'].flatMap(face => [0, 1, 2].map(index => `${face}${index}`)), ...pair];

/** Each shot follows the teaching script; classification concerns only the selected pair. */
export function nonstandardIntroScenes(edgeSetup: string, cornerSetup: string, orientation: string, terminologyOnly = false): NonstandardIntroScene[] {
  const colors = orientedFaceColors(orientation);
  const front = CUBE_COLOR_NAMES[colors.F];
  const right = CUBE_COLOR_NAMES[colors.R];
  const targetSlotCaption = {
    zh: `不管${front.zh}${right.zh}棱角在哪，目标槽指的都是${front.zh}${right.zh}中心块和底面夹起来的位置`,
    en: `Wherever the ${front.en}-${right.en} edge and its matching corner are, their target slot is always the space between the ${front.en} and ${right.en} centers and the bottom face`,
  };
  const scenes: NonstandardIntroScene[] = [
    {
      caption: { zh: '当我们复原了底十字之后', en: 'Once we have solved the bottom cross…' },
      setup: `${topSetup} F R B L`, alg: "L' B' R' F'", duration: 5900,
      highlight: [], crossOnly: true, showBottom: true,
    },
    {
      caption: { zh: '选定要复原的一组棱角', en: 'Choose an edge and corner to solve together' },
      setup: topSetup, alg: '', duration: 12000, highlight: pair,
      flashPair: true,
      continuePrevious: true,
      beats: [
        { at: 0, caption: { zh: '要选定一个待复原的角块', en: 'Choose a corner to solve' },
          label: { zh: '目标角', en: 'Target corner' }, highlight: corner, pulse: true, hideEdge: true },
        { at: 3500, caption: { zh: '以及对应的棱块', en: 'And its matching edge' },
          label: { zh: '目标棱', en: 'Target edge' }, highlight: edge, pulse: true, hideCorner: true },
        { at: 7000, caption: terminologyOnly
          ? { zh: '棱块的两种颜色和角块的两种侧面色相同，它们就是一组棱角（pair）', en: 'An edge and a corner that share the same two side colors form an F2L pair' }
          : { zh: '关注这组棱角', en: 'Focus on this pair' },
          label: { zh: '一组棱角', en: 'One pair' }, highlight: pair },
      ],
    },
    {
      caption: { zh: '目标角块和棱块需要到达的位置叫目标槽', en: 'The positions where this corner and edge belong form their target slot' },
      setup: topSetup, alg: "R U' R'", duration: 14000, highlight: pair,
      continuePrevious: true,
      moveStart: 3500, moveGap: 300, moveDuration: 950,
      beats: [
        { at: 0, caption: { zh: '这组棱角最终要去哪里？', en: 'Where does this pair belong?' }, highlight: pair },
        { at: 3500, caption: { zh: '看看它们复原后的位置', en: 'Watch where the pieces go as we solve them' }, highlight: pair },
        { at: 7500, caption: { zh: '就是这组棱角的目标槽', en: 'This is the pair’s target slot' },
          label: { zh: '目标槽', en: 'Target slot' },
          highlight: pair, pulse: true },
      ],
    },
    {
      caption: targetSlotCaption,
      setup: '', alg: topSetup, duration: 12000, moveStart: 900, moveDuration: 950,
      continuePrevious: true,
      highlight: pair,
      beats: [
        { at: 0, caption: targetSlotCaption,
          label: { zh: '目标槽', en: 'Target slot' },
          highlight: pair, pulse: true },
        { at: 600, caption: targetSlotCaption,
          highlight: [] },
        { at: 1300, caption: targetSlotCaption,
          label: { zh: '目标槽', en: 'Target slot' },
          highlight: stickersAt(topSetup, pair), pulse: true },
      ],
    },
    {
      caption: { zh: '如果这两个块都在顶层或它们自己的目标槽内，称为基态', en: 'If both pieces are in the top layer or their own target slot, it is a standard case' },
      setup: topSetup, alg: '', duration: 6000, highlight: stickersAt(topSetup, topAndSlot), hidePair: true,
      continuePrevious: true, moveDuration: 950,
    },
    {
      caption: { zh: '它们可以都在顶层', en: 'They can both be in the top layer' },
      setup: topSetup, alg: '', duration: 4000, highlight: [], result: 'standard',
    },
    {
      caption: { zh: '可以一个在顶层一个在槽内', en: 'One can be in the top layer and the other in their slot' },
      setup: setupOf('E+'), alg: '', duration: 5000, highlight: [], result: 'standard',
    },
    {
      caption: { zh: '或者都在槽内', en: 'Or both can be in their slot' },
      setup: setupOf('F'), alg: '', duration: 4000, highlight: [], result: 'standard',
    },
    {
      caption: { zh: '如果其中任何一个块位于其他槽内，就是“非标”', en: 'If either piece is in another slot, the case is non-standard' },
      setup: edgeSetup, alg: '', duration: 6000, highlight: edge, result: 'nonstandard',
      revealLeft: true,
    },
    {
      caption: { zh: '如果其中任何一个块位于其他槽内，就是“非标”', en: 'If either piece is in another slot, the case is non-standard' },
      setup: cornerSetup, alg: '', duration: 6000, highlight: corner, result: 'nonstandard',
      showBottom: true, bottomTilt: 1,
    },
  ];
  if (!terminologyOnly) return scenes;
  const firstNonstandard = scenes.findIndex(scene => scene.result === 'nonstandard');
  const crossCaption = { zh: '先完成底十字', en: 'Start by solving the bottom cross' };
  const slotCaption = { zh: '先看右前方', en: 'Look at the front-right corner of the cube' };
  const namingCaption = { zh: '用相邻的两个侧面中心块颜色给槽命名', en: 'Name each slot after its two adjacent side centers' };
  const firstTurnAt = 11000;
  const turnGap = 2600;
  const summaryAt = firstTurnAt + 3 * turnGap + 200;
  const slotBeats = (['F', 'R', 'B', 'L'] as const).flatMap((face, index, sides) => {
    const first = CUBE_COLOR_NAMES[colors[face]];
    const second = CUBE_COLOR_NAMES[colors[sides[(index + 1) % sides.length]]];
    const turned = Array<string>(index).fill('y').join(' ');
    return [{
      at: index === 0 ? 8500 : firstTurnAt + (index - 1) * turnGap + 100,
      caption: namingCaption,
      label: { zh: `${first.zh}${second.zh}槽`, en: `${first.en}–${second.en} slot` },
      highlight: stickersAt(`${topSetup} ${turned}`, pair),
    }, {
      at: firstTurnAt + index * turnGap,
      caption: namingCaption,
      highlight: [],
    }];
  });
  return [{
    ...scenes[0], caption: crossCaption, moveDuration: 950, duration: 8600,
    beats: [{ at: 5400, caption: { zh: '底十字做好了，接下来把剩下的棱角放回前两层', en: 'The cross is solved, so we can put the remaining edges and corners back into the first two layers' }, highlight: [] }],
  }, {
    caption: slotCaption,
    setup: topSetup, alg: 'y y y y', duration: summaryAt + 5000,
    moveStart: firstTurnAt, moveGap: turnGap, moveDuration: 950,
    highlight: [], hidePair: true,
    continuePrevious: true,
    beats: [
      { at: 0, caption: slotCaption, highlight: [] },
      { at: 1800, caption: { zh: '底层有一个角位', en: 'There’s a corner position in the bottom layer' }, highlight: stickersAt(topSetup, corner) },
      { at: 3600, caption: { zh: '它正上方有一个棱位', en: 'There’s an edge position directly above it' }, highlight: stickersAt(topSetup, edge) },
      { at: 5400, caption: { zh: '两个位置合起来，就是一个槽（slot）', en: 'Together, these two positions make a slot' }, highlight: stickersAt(topSetup, pair) },
      ...slotBeats, {
      at: summaryAt,
      caption: { zh: '底十字周围一共有四个槽', en: 'There are four slots around the bottom cross' },
      highlight: stickersAt(topSetup, [
        ...pair, 'R5', 'B3', 'R8', 'B6', 'D8',
        'B5', 'L3', 'B8', 'L6', 'D6', 'L5', 'F3', 'L8', 'F6', 'D0',
      ]),
    }, {
      at: summaryAt + 2300,
      caption: { zh: '接下来挑一组棱角，看看它们该回哪个槽', en: 'Next, let’s pick a pair and see which slot it belongs in' },
      highlight: [],
    }],
  }, { ...scenes[1], moveDuration: 950, fadeInPair: true }, ...scenes.slice(2, firstNonstandard).map((scene, index, remaining) =>
    index === remaining.length - 1 ? { ...scene, duration: scene.duration + TERMINOLOGY_OUTRO_MS } : scene)];
}
