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
export function nonstandardIntroScenes(edgeSetup: string, cornerSetup: string, orientation: string): NonstandardIntroScene[] {
  const colors = orientedFaceColors(orientation);
  const front = CUBE_COLOR_NAMES[colors.F];
  const right = CUBE_COLOR_NAMES[colors.R];
  const targetSlotCaption = {
    zh: `不管${front.zh}${right.zh}棱角在哪，目标槽指的都是${front.zh}${right.zh}中心块和底面夹起来的位置`,
    en: `Wherever the ${front.en}-${right.en} edge and its matching corner are, their target slot is always the space between the ${front.en} and ${right.en} centers and the bottom face`,
  };
  return [
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
        { at: 7000, caption: { zh: '关注这组棱角', en: 'Focus on this pair' },
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
      caption: { zh: '如果这两个块都在顶层或它们自己的目标槽内，称为标态', en: 'If both pieces are in the top layer or their own target slot, it is a standard case' },
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
}
