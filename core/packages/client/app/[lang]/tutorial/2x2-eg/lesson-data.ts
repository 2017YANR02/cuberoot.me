import { invertMoveString } from '@cuberoot/shared/alg-notation';
import { simplifyAlg } from '@cuberoot/shared/recon/cube3';
import { Face } from '@cuberoot/visualcube';
import { twoByTwoState } from '../lib/2x2-state';
import { EG_CASE_ALGS } from './case-algs';

export const EG_SETS = [
  { id: 'cll', name: 'CLL' },
  { id: 'eg1', name: 'EG-1' },
  { id: 'eg2', name: 'EG-2' },
] as const;

export type EgSet = typeof EG_SETS[number]['id'];

export const EG_SHAPES = [
  { id: 'o', name: { zh: 'O · 全黄', en: 'O · All yellow' }, count: 4, example: 'O-adjacent',
    clue: { zh: '顶面四格全黄。接着看侧面的顶排有几组同色。', en: 'All four top stickers are yellow. Check which upper side rows match.' } },
  { id: 'sune', name: { zh: 'S+ · 右鱼', en: 'S+ · Sune' }, count: 1, example: 'S+U',
    clue: { zh: '只有一个黄格朝上。看三片侧面的鱼鳍，它们都在各自侧面的右格。', en: 'One yellow sticker faces up. Each of the three yellow side stickers sits on the right of its face.' } },
  { id: 'antisune', name: { zh: 'S− · 左鱼', en: 'S− · Anti-Sune' }, count: 1, example: 'S-U',
    clue: { zh: '只有一个黄格朝上，三个侧面的鱼鳍都在各自侧面的左格。', en: 'One yellow sticker faces up. Each of the three yellow side stickers sits on the left of its face.' } },
  { id: 'u', name: { zh: 'U', en: 'U' }, count: 2, example: 'UD',
    clue: { zh: '顶面两黄相邻，另外两黄在同一个侧面。', en: 'The two top yellows are adjacent, and the other two share one side face.' } },
  { id: 't', name: { zh: 'T', en: 'T' }, count: 2, example: 'TL',
    clue: { zh: '顶面两黄相邻，另外两黄分在相对的侧面。', en: 'The two top yellows are adjacent, and the other two are on opposite side faces.' } },
  { id: 'l', name: { zh: 'L', en: 'L' }, count: 2, example: 'LR',
    clue: { zh: '顶面两黄在对角，另外两黄在相邻的侧面。', en: 'The two top yellows are diagonal, and the other two are on neighboring side faces.' } },
  { id: 'h', name: { zh: 'H', en: 'H' }, count: 0, example: 'HU',
    clue: { zh: '顶面没有黄格。侧面有两组并排的黄格。', en: 'No yellow faces up. Two side faces each have a pair of yellow stickers.' } },
  { id: 'pi', name: { zh: 'Pi', en: 'Pi' }, count: 0, example: 'PiU',
    clue: { zh: '顶面没有黄格。侧面只有一组并排的黄格。', en: 'No yellow faces up. Only one side face has a pair of yellow stickers.' } },
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
  cll: { zh: '四条棒。底面全白，四个侧面的底排也分别同色。',
    en: 'Four bars. The four side rows match as well as the white bottom face.' },
  eg1: { zh: '一条棒。白底已经做好，底层还差一组相邻角交换。本站公式统一把棒放到后面。',
    en: 'One bar. The white face is complete and two adjacent bottom corners still need to swap. Hold the bar at the back for every EG-1 alg here.' },
  eg2: { zh: '没有棒。白底已经做好，底层还差一组对角交换。',
    en: 'No bars. The white face is complete and two diagonal bottom corners still need to swap.' },
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

export type EgWalkthrough = {
  entry: EgCase;
  start: string;
  face: string;
  regrip: string;
  align: string;
  finish: string;
};

function buildEgWalkthrough(entry: EgCase, face: string, regrip: string, align: string, finish: string): EgWalkthrough {
  const start = simplifyAlg(egMoves(invertEg(finish), entry.setup, invertEg(align), invertEg(regrip), invertEg(face)));
  return { start, face, regrip, align, finish, entry };
}

export const EG_WALKTHROUGH = buildEgWalkthrough(egCase('eg1', 'S+U'), "R U R'", "y'", 'U', 'U');

const faceOpenings = ["R U R'", "L' U' L", "F2 U' R U R'", "R2 U2 L' U' L", "L U F U' F'", "R U F U' F'"];
const regrips = ['y', 'y2', "y'"];
const topTurns = ['U', 'U2', "U'"];
const finishingTurns = ['', ...topTurns];

export function randomEgWalkthrough(previous: EgCase, randomBelow = (limit: number) => Math.floor(Math.random() * limit)): EgWalkthrough {
  const cases = EG_CASES.filter(entry => entry.set !== previous.set || entry.id !== previous.id);
  const entry = cases[randomBelow(cases.length)];
  const face = faceOpenings[randomBelow(faceOpenings.length)];
  const regrip = entry.set === 'eg1' ? regrips[randomBelow(regrips.length)] : '';
  const align = topTurns[randomBelow(topTurns.length)];
  const finish = finishingTurns[randomBelow(finishingTurns.length)];
  return buildEgWalkthrough(entry, face, regrip, align, finish);
}
