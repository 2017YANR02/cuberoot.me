import { Face } from '@cuberoot/visualcube';
import { invertMoveString } from '@cuberoot/shared/alg-notation';
import { CUBE_ORIENTATIONS } from '@/lib/cube-orientation';
import { isWhiteFirstLayer, twoByTwoState } from '../lib/2x2-state';
import { LEFT, LEFT_SUNE, RIGHT, RIGHT_SUNE } from '../lbl/content';
import {
  cornerStickers, eyeAt, finalCornerAlg, firstCorner, fish, leftFishAligned, rightFishAligned, secondCorner, sides,
  solved, thirdCorner, touchesYellow, TWO_BY_TWO_ORIENTATION, TWO_BY_TWO_OVERVIEW, TWO_BY_TWO_SAMPLE, yellowFace,
} from './lesson-data';

type Text = { zh: string; en: string };
export type WalkthroughStep = { title: Text; alg: string; note: Text; formula?: string };
export type WalkthroughCase = { scramble: string; phases: readonly { title: Text; steps: readonly WalkthroughStep[] }[] };
type State = ReturnType<typeof twoByTwoState>;
type ReadState = (...moves: string[]) => State;

const uTurns = ['', 'U', "U'", 'U2'];
const yTurns = ['', 'y', "y'", 'y2'];
const alignmentMoves = ['', 'R', "R'", 'R2'].flatMap(right => uTurns.map(up => join(right, up)));
const [first, second, third, fourth] = TWO_BY_TWO_SAMPLE[0].sections;
const solvedState = twoByTwoState('');
const whiteGreenFrame = invertMoveString(TWO_BY_TWO_ORIENTATION);
const sideNames = {
  [Face.F]: { zh: '前面', en: 'the front' }, [Face.R]: { zh: '右面', en: 'the right' },
  [Face.B]: { zh: '后面', en: 'the back' }, [Face.L]: { zh: '左面', en: 'the left' },
};

function join(...moves: string[]) {
  return moves.filter(Boolean).join(' ');
}

function cornerColors(state: State, slot: number) {
  return cornerStickers[slot].map(({ face, index }) => state[face][index]).sort().join('');
}

function insertCorner(read: ReadState, title: Text, home: number, left: boolean, last: boolean,
  complete: (state: State) => boolean): WalkthroughStep {
  if (complete(read())) return {
    title, alg: '',
    note: { zh: '这个白角已归位，白格朝下，侧面的颜色也已对齐',
      en: 'This white corner is already in place, with white down and both side colors lined up.' },
  };
  const frame = last ? 'y' : '';
  const target = cornerColors(solvedState, home);
  const slots = left ? [4, 6] : [5, 7];
  const setup = (last ? uTurns : alignmentMoves).find(turn => {
    const state = read(frame, turn);
    return slots.some(slot => cornerColors(state, slot) === target);
  });
  if (setup === undefined) throw new Error('No setup for the LBL corner');
  const trigger = left ? LEFT : RIGHT;
  let alg = '';
  for (let repeats = 0; repeats <= 5; repeats++) {
    const done = complete(read(frame, setup, alg));
    if (!done) {
      alg = join(alg, trigger);
      continue;
    }
    const align = join(frame, setup);
    if (!repeats) return {
      title, alg: align,
      note: { zh: `做 ${align} 后，角块正好归位。检查白格朝下、侧色已经对齐`,
        en: `After ${align}, the corner is in place. Check that white faces down and the side colors line up.` },
    };
    const handZh = left ? '左手' : '右手';
    const handEn = left ? 'left-hand' : 'right-hand';
    const sideZh = left ? '左前' : '右前';
    const sideEn = left ? 'front-left' : 'front-right';
    return {
      title, alg: join(align, alg), formula: trigger,
      note: {
        zh: `${align ? `先做 ${align}，把角块摆到${sideZh}` : `角块已在${sideZh}`}。做 ${repeats} 次${handZh}「上勾下回」，直到白格朝下、侧色对齐`,
        en: `${align ? `Use ${align} to bring the corner to the ${sideEn}` : `The corner is already at the ${sideEn}`}. Do the ${handEn} trigger ${repeats === 1 ? 'once' : `${repeats} times`} to face white down and line up the side colors.`,
      },
    };
  }
  throw new Error(`No insertion for ${title.en}`);
}

export function buildTwoByTwoWalkthrough(scramble: string): WalkthroughCase {
  // The state reader's solved palette is yellow up and red front.
  let setup = join(whiteGreenFrame, scramble);
  const read: ReadState = (...moves) => twoByTwoState(join(setup, ...moves));
  const white: WalkthroughStep[] = [];
  const yellow: WalkthroughStep[] = [];
  const corners: WalkthroughStep[] = [];
  const add = (steps: WalkthroughStep[], step: WalkthroughStep) => {
    steps.push(step);
    setup = join(setup, step.alg);
  };

  const grip = CUBE_ORIENTATIONS.find(({ value }) => firstCorner(read(value)))?.value;
  if (grip === undefined) throw new Error('No starting grip for the LBL walkthrough');
  add(white, { title: first.title, alg: grip, note: grip
    ? { zh: `找到白、橙、蓝相连的角。做 ${grip}，把它放到左后下方，白格朝下`,
      en: `Find the white–orange–blue corner. Use ${grip} to put it at bottom back-left, white facing down.` }
    : { zh: '白橙蓝角已在左后下方，白格朝下。从这颗角开始拼白底',
      en: 'The white–orange–blue corner is already at bottom back-left with white down. Use it as the first white corner.' } });
  add(white, insertCorner(read, second.title, 4, true, false, secondCorner));
  add(white, insertCorner(read, third.title, 5, false, false, thirdCorner));
  add(white, insertCorner(read, fourth.title, 1, false, true, isWhiteFirstLayer));

  if (!yellowFace(read()) && !fish(read())) {
    const twoYellows = read()[Face.U].filter(color => color === 'Y').length === 2;
    const turn = uTurns.find(move => touchesYellow(read(move)) === twoYellows && fish(read(move, RIGHT_SUNE)));
    if (turn === undefined) throw new Error('No yellow-face setup for the LBL walkthrough');
    const placement = twoYellows
      ? { zh: '前面左上格是黄色', en: 'the front upper-left sticker is yellow' }
      : { zh: '前面左上格不是黄色', en: 'the front upper-left sticker is not yellow' };
    add(yellow, {
      title: twoYellows ? { zh: '二碰变小鱼', en: 'Make a fish from two yellows' } : { zh: '四不碰变小鱼', en: 'Make a fish from zero yellows' },
      alg: join(turn, RIGHT_SUNE),
      formula: RIGHT_SUNE,
      note: {
        zh: `${turn ? `先做 ${turn}，让${placement.zh}` : `此时${placement.zh}`}。做右鱼公式后，顶面剩一个黄格`,
        en: `${turn ? `Use ${turn} so ${placement.en}` : `Check that ${placement.en}`}. Do the right Sune to leave one yellow sticker on top.`,
      },
    });
  }
  if (!yellowFace(read())) {
    const fishCases = [
      { name: { zh: '右鱼', en: 'right Sune' }, alg: RIGHT_SUNE, matches: rightFishAligned, side: { zh: '左前', en: 'front-left' } },
      { name: { zh: '左鱼', en: 'left Sune' }, alg: LEFT_SUNE, matches: leftFishAligned, side: { zh: '右前', en: 'front-right' } },
    ];
    const aligned = uTurns.flatMap(turn => fishCases.map(shape => ({ turn, shape })))
      .find(({ turn, shape }) => shape.matches(read(turn)) && yellowFace(read(turn, shape.alg)));
    if (!aligned) throw new Error('No fish algorithm for the LBL walkthrough');
    const { turn, shape } = aligned;
    add(yellow, {
      title: { zh: `用${shape.name.zh}翻出黄面`, en: `Turn the top yellow with the ${shape.name.en}` },
      alg: join(turn, shape.alg),
      formula: shape.alg,
      note: {
        zh: `${turn ? `先做 ${turn}，把鱼头摆到顶面${shape.side.zh}` : `鱼头已经在顶面${shape.side.zh}`}。做${shape.name.zh}公式后，顶面全黄，白底照样复原`,
        en: `${turn ? `Use ${turn} to put the fish head at top ${shape.side.en}` : `The fish head is already at top ${shape.side.en}`}. Do the ${shape.name.en} to turn the top yellow and keep the first layer solved.`,
      },
    });
  } else if (!yellow.length) {
    add(yellow, { title: { zh: '顶面已全黄', en: 'The top is already yellow' }, alg: '',
      note: { zh: '四个黄格已经朝上，直接看侧面的角位置', en: 'All four yellow stickers already face up. Move on to the side colors.' } });
  }

  let eyes = sides.filter(side => eyeAt(read(), side));
  if (!eyes.length) {
    const side = sides.find(face => eyeAt(read(finalCornerAlg), face));
    if (side === undefined) throw new Error('No headlights after the LBL corner algorithm');
    add(corners, { title: { zh: '无眼，先造一对眼', en: 'Make a pair of headlights' }, alg: finalCornerAlg, formula: finalCornerAlg,
      note: { zh: `四个侧面的顶排都不同色。做角位置公式后，${sideNames[side].zh}会出现一对同色顶格`,
        en: `None of the side top rows match. Do the corner placement algorithm to make a matching pair on ${sideNames[side].en}.` } });
    eyes = [side];
  }
  if (eyes.length === 1) {
    const turn = yTurns.find(move => eyeAt(read(move), Face.R));
    if (turn === undefined) throw new Error('No right-side headlights for the LBL walkthrough');
    add(corners, { title: { zh: '把眼放右面，再做公式', en: 'Use the headlights on the right' }, alg: join(turn, finalCornerAlg), formula: finalCornerAlg,
      note: { zh: `${turn ? `做 ${turn}，把${sideNames[eyes[0]].zh}的一对眼移到右面` : '一对眼已经在右面'}。做角位置公式，让四个顶角依次排好`,
        en: `${turn ? `Use ${turn} to move the headlights from ${sideNames[eyes[0]].en} to the right` : 'The headlights are already on the right'}. Do the corner placement algorithm to put the top corners in order.` } });
  }
  if (!solved(read())) {
    const turn = uTurns.find(move => solved(read(move)));
    if (!turn) throw new Error('No top adjustment for the LBL walkthrough');
    add(corners, { title: { zh: '对齐顶层', en: 'Align the top layer' }, alg: turn,
      note: { zh: `只差顶层对齐。做 ${turn}，让四个侧面的顶排和底排接上，六面复原`,
        en: `Use ${turn} to line up the top and bottom rows on all four sides and finish the solve.` } });
  } else if (!corners.length) {
    add(corners, { title: { zh: '六面已复原', en: 'All six faces are solved' }, alg: '',
      note: { zh: '四个侧面的顶排和底排已对齐，角位置这一步可以跳过', en: 'The top and bottom rows already match on every side. No further turns are needed.' } });
  }
  return { scramble, phases: [white, yellow, corners].map((steps, index) => ({ title: TWO_BY_TWO_OVERVIEW[index].title, steps })) };
}

export async function randomTwoByTwoWalkthrough(previous: string, rng = Math.random) {
  const { wcaPocketScramble } = await import('@/lib/pocket-scramble');
  for (let attempt = 0; attempt < 3; attempt++) {
    const scramble = wcaPocketScramble(rng);
    if (scramble !== previous) return buildTwoByTwoWalkthrough(scramble);
  }
  throw new Error('Could not generate a different LBL scramble');
}
