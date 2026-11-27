import { invertMoveString } from '@cuberoot/shared/alg-notation';
import { Face } from '@cuberoot/visualcube';
import { twoByTwoState } from '../lib/2x2-state';
import { EG_CASE_ALGS } from './case-algs';
import type { EgColorName as ColorName } from './orientation';

export const EG_SETS = [
  { id: 'cll', name: 'CLL' },
  { id: 'eg1', name: 'EG-1' },
  { id: 'eg2', name: 'EG-2' },
] as const;

export type EgSet = typeof EG_SETS[number]['id'];

export const EG_BOTTOM_ROW_LABELS = {
  cll: { zh: '4 个同色底排', en: '4 matching bottom rows' },
  eg1: { zh: '1 个同色底排', en: '1 matching bottom row' },
  eg2: { zh: '0 个同色底排', en: '0 matching bottom rows' },
} satisfies Record<EgSet, { zh: string; en: string }>;

export const EG_SHAPES = [
  { id: 'o', name: { zh: 'O', en: 'O' }, count: 4, example: 'O-adjacent',
    clue: (top: ColorName) => ({ zh: `顶面四格都是${top.zh}色。接着看侧面的顶排有几组同色。`, en: `All four top stickers are ${top.en}. Check which upper side rows match.` }) },
  { id: 'sune', name: { zh: 'S+', en: 'S+' }, count: 1, example: 'S+U',
    clue: (top: ColorName) => ({ zh: `只有一个${top.zh}格朝上。看三片侧面的鱼鳍，它们都在各自侧面的右格。`, en: `One ${top.en} sticker faces up. Each of the three ${top.en} side stickers sits on the right of its face.` }) },
  { id: 'antisune', name: { zh: 'S−', en: 'S−' }, count: 1, example: 'S-U',
    clue: (top: ColorName) => ({ zh: `只有一个${top.zh}格朝上，三个侧面的鱼鳍都在各自侧面的左格。`, en: `One ${top.en} sticker faces up. Each of the three ${top.en} side stickers sits on the left of its face.` }) },
  { id: 'u', name: { zh: 'U', en: 'U' }, count: 2, example: 'UD',
    clue: (top: ColorName) => ({ zh: `顶面两个${top.zh}格相邻，另外两个在同一个侧面。`, en: `The two ${top.en} stickers on top are adjacent. The other two share one side face.` }) },
  { id: 't', name: { zh: 'T', en: 'T' }, count: 2, example: 'TL',
    clue: (top: ColorName) => ({ zh: `顶面两个${top.zh}格相邻，另外两个分在相对的侧面。`, en: `The two ${top.en} stickers on top are adjacent. The other two are on opposite side faces.` }) },
  { id: 'l', name: { zh: 'L', en: 'L' }, count: 2, example: 'LR',
    clue: (top: ColorName) => ({ zh: `顶面两个${top.zh}格在对角，另外两个在相邻的侧面。`, en: `The two ${top.en} stickers on top are diagonal. The other two are on neighboring side faces.` }) },
  { id: 'h', name: { zh: 'H', en: 'H' }, count: 0, example: 'HU',
    clue: (top: ColorName) => ({ zh: `顶面没有${top.zh}格。侧面有两组并排的${top.zh}格。`, en: `No ${top.en} faces up. Two side faces each have a pair of ${top.en} stickers.` }) },
  { id: 'pi', name: { zh: 'Pi', en: 'Pi' }, count: 0, example: 'PiU',
    clue: (top: ColorName) => ({ zh: `顶面没有${top.zh}格。侧面只有一组并排的${top.zh}格。`, en: `No ${top.en} faces up. Only one side face has a pair of ${top.en} stickers.` }) },
] as const;

export type EgShape = typeof EG_SHAPES[number]['id'];
export type EgCase = { id: string; shape: EgShape; set: EgSet; alg: string; setup: string };
const casePrefixes = [['O-', 'o'], ['S+', 'sune'], ['S-', 'antisune'], ['U', 'u'],
  ['T', 't'], ['L', 'l'], ['H', 'h'], ['Pi', 'pi']] as const;
const sideFaces = [Face.F, Face.R, Face.B, Face.L] as const;

export const invertEg = (alg: string) => invertMoveString(alg).replaceAll("2'", '2');
export const egMoves = (...moves: string[]) => moves.filter(Boolean).join(' ');

export const EG_RECOGNITION_CASES = EG_CASE_ALGS.flatMap(([id, ...algs]) => {
  const shape = casePrefixes.find(([prefix]) => id.startsWith(prefix))![1];
  return EG_SETS.map(({ id: set }, index): EgCase => {
    const alg = algs[index];
    return { id, shape, set, alg, setup: invertEg(alg) };
  });
});
export const EG_CASES = EG_RECOGNITION_CASES.filter(entry => entry.alg);

export function egCase(set: EgSet, id: string) {
  const entry = EG_CASES.find(item => item.set === set && item.id === id);
  if (!entry) throw new Error(`Unknown EG lesson case ${set}/${id}`);
  return entry;
}

export function egCaseName(id: string) {
  switch (id) {
    case 'O-solved': return { zh: '顶层四面同色', en: 'Top has four bars' };
    case 'O-adjacent': return { zh: '顶层单条棒', en: 'Top has one bar' };
    case 'O-diagonal': return { zh: '顶层无棒', en: 'Top has no bar' };
    default: {
      const name = id.replace('S-', 'S−');
      return { zh: name, en: name };
    }
  }
}

export const EG_BOTTOM = {
  cll: { zh: '底面已经拼好，四个侧面的底排也都对齐，第一层已经复原。',
    en: 'The bottom face and all four bottom side rows are solved, completing the first layer.' },
  eg1: { zh: '底面已经拼好，底层还差两个相邻角互换。做公式时，把唯一的同色棒放在后面。',
    en: 'The bottom face is complete and two adjacent bottom corners still need to swap. Hold the only bar at the back to start the algorithm.' },
  eg2: { zh: '底面已经拼好，四个侧面的底排都是对色，底层还差两个对角互换。',
    en: 'The bottom face is complete. Each bottom side row shows opposite colors, with two diagonal corners left to swap.' },
} satisfies Record<EgSet, { zh: string; en: string }>;

export function egBottomRows(setup: string) {
  const state = twoByTwoState(setup);
  return sideFaces.map(face => state[face].slice(2).join(''));
}

export function egTopKey(setup: string) {
  const state = twoByTwoState(setup);
  const sideColors = 'RGOB';
  const top = state[Face.U].join('') + sideFaces.map(face => state[face].slice(0, 2).join('')).join('');
  // A cyclic change of side colors shifts the final U alignment and keeps the same case.
  return [0, 1, 2, 3].map(n => top.replace(/[RGOB]/g, color =>
    sideColors[(sideColors.indexOf(color) + n) % 4])).sort()[0];
}
