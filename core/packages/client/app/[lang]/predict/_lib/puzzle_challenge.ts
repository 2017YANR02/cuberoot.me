/**
 * 非三阶拼图的 /predict 出题引擎 —— 「这枚贴纸转完落在哪」的通用版。
 *
 * 出题三步和三阶那版(`./challenge.ts`)一模一样,只是全程按**贴纸置换**说话,不认
 * 任何一种拼图的块结构:
 *   1. 从块表里挑一块(或一对),在它的贴纸里选一枚要追踪的;
 *   2. 用隐藏的乱转把整个拼图甩到随机状态 —— 这就是屏幕上看到的起点;
 *   3. 生成题面公式,把那枚贴纸的落点算出来,那就是唯一正确答案。
 *
 * 三阶不走这里:它还带十字 / 前两层 / F2L 三档按解法阶段出题的模式,块池要按方法学
 * 挑,和这套「全盘随机挑一块」不是一回事。两边的输出形状对齐(见 `PredictBoardChallenge`),
 * 页面只认那个形状,所以页面代码不分叉。
 */
import {
  identityPerm, stickerCount,
  type PredictPieceKind, type PredictPuzzle,
} from './puzzles';

/** 出题选项里的「追踪对象」:块类别,或者「一对」= 一角一棱各追一枚。 */
export type PredictTrack = PredictPieceKind | 'pair';

export interface PredictBoardTarget {
  kind: PredictPieceKind;
  /** 要追踪的那枚贴纸的本位面序号(`puzzle.faces` 的下标)—— 显示颜色由它决定。 */
  colorFace: number;
  /** 出题时这枚贴纸所在的格(屏幕上高亮的位置)。 */
  startFacelet: number;
  /** 公式做完后它落在的格 —— 唯一正确答案。 */
  answerFacelet: number;
}

/** 页面消费的题目形状。三阶引擎的 `PredictChallenge` 是它的超集,所以两边通用。 */
export interface PredictBoardChallenge {
  moves: string[];
  targets: PredictBoardTarget[];
  /** 起始盘面每一格的真实颜色(面字母)。 */
  startColors: string;
  /** 目标块整块的贴纸画出来(面字母),其余 `.`(压暗)。 */
  startFacelets: string;
}

export interface PuzzleChallenge extends PredictBoardChallenge {
  /** 把拼图甩到起点位的隐藏乱转;题面不展示,留给测试重建盘面。 */
  placement: string[];
}

export interface PuzzleChallengeOptions {
  puzzle: PredictPuzzle;
  track: PredictTrack;
  source: 'random' | 'custom';
  moveCount: number;
  /** `source='custom'` 时的题面,已经过 `puzzle.parse`。 */
  customMoves?: readonly string[];
  /** 注入随机源,测试里可给确定性实现。 */
  random?: () => number;
}

const pick = <T,>(arr: readonly T[], rnd: () => number): T => arr[Math.floor(rnd() * arr.length)];

/** 这个拼图有没有「一对」这一档 —— 角和棱都能追才有。 */
export const hasPairTrack = (p: PredictPuzzle): boolean =>
  p.trackable.includes('corner') && p.trackable.includes('edge');

/** UI 上这个拼图能选的追踪对象。 */
export const trackOptions = (p: PredictPuzzle): PredictTrack[] =>
  hasPairTrack(p) ? [...p.trackable, 'pair'] : [...p.trackable];

/** perm 里某枚本位贴纸现在坐在哪一格。 */
function slotOf(perm: readonly number[], home: number): number {
  const i = perm.indexOf(home);
  if (i < 0) throw new Error(`[predict] sticker ${home} not on the puzzle`);
  return i;
}

export function generatePuzzleChallenge(opts: PuzzleChallengeOptions): PuzzleChallenge {
  const rnd = opts.random ?? Math.random;
  const { puzzle } = opts;
  const n = stickerCount(puzzle);

  const byKind = (kind: PredictPieceKind): readonly (readonly number[])[] =>
    puzzle.pieces.filter((p) => puzzle.kindOf(p) === kind);

  /** 选中的块 + 块上要追的那枚贴纸(本位下标)。 */
  const picks: { kind: PredictPieceKind; piece: readonly number[]; sticker: number }[] = [];
  const take = (kind: PredictPieceKind, avoidFace: number | null): void => {
    const pool = byKind(kind);
    if (pool.length === 0) return;
    const piece = pick(pool, rnd);
    // 「一对」的两枚不要同色 —— 同色的话题面两句话长得一模一样,读不出在问哪一枚。
    const allowed = avoidFace === null
      ? piece
      : piece.filter((s) => Math.floor(s / puzzle.perFace) !== avoidFace);
    picks.push({ kind, piece, sticker: pick(allowed.length ? allowed : piece, rnd) });
  };

  if (opts.track === 'pair') {
    take('corner', null);
    const first = picks[0];
    take('edge', first ? Math.floor(first.sticker / puzzle.perFace) : null);
  } else {
    take(opts.track, null);
  }
  // 块池空到一块都挑不出来(理论上不会:UI 只给 `trackable` 里的档)——
  // 兜个角块回来,总比出一道没有目标的题强。
  if (picks.length === 0) take('corner', null);

  const placement = puzzle.placementMoves(rnd);
  const startPerm = puzzle.apply(identityPerm(n), placement);

  const moves = opts.source === 'custom'
    ? [...(opts.customMoves ?? [])]
    : puzzle.randomMoves(Math.max(1, Math.min(opts.moveCount, puzzle.moveCountMax)), rnd);
  const endPerm = puzzle.apply(startPerm, moves);

  const targets: PredictBoardTarget[] = picks.map((p) => ({
    kind: p.kind,
    colorFace: Math.floor(p.sticker / puzzle.perFace),
    startFacelet: slotOf(startPerm, p.sticker),
    answerFacelet: slotOf(endPerm, p.sticker),
  }));

  const startColors = startPerm
    .map((home) => puzzle.faces[Math.floor(home / puzzle.perFace)])
    .join('');

  // 目标块整块画出来:同块的其余贴纸只用来认出「这几枚是一块的」,页面会把它们压暗。
  const painted = Array<string>(n).fill('.');
  for (const p of picks) {
    for (const home of p.piece) {
      painted[slotOf(startPerm, home)] = puzzle.faces[Math.floor(home / puzzle.perFace)];
    }
  }

  return { moves, placement, targets, startColors, startFacelets: painted.join('') };
}
