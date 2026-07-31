/**
 * 金字塔魔方的 /predict 模型。
 *
 * 状态机复用站内那份 tnoodle 移植 `PyraminxState`(打乱预览图用的同一份,`image[面][格]`
 * 直接就是贴纸 id),记号也就是 tnoodle / WCA 那套:`U L R B` 顶点层 + 小写 `u l r b`
 * 只转尖角,撇 = 逆。`/sim` 引擎的 `parsePyraMoves` 收的是同一批 token,所以题面那串
 * 原样喂给引擎就能播动画 —— 两边是不是同一个物理转动,由 tests/predict_puzzles.test.ts
 * 拿引擎几何逐格核对。
 *
 * 面层记号(`Dw` / `Lw` / `Rw` / `Fw`)不收:tnoodle 模型里没有,判定层算不出来。
 */
import {
  PyraminxState, PYRA_FACE_LABELS, PYRA_STICKERS_PER_FACE,
} from '@/app/[lang]/scramble/gen/_svg/pyraminx_svg';
import { PIECE_GROUPS } from '@/lib/puzzle-image/puzzle-mask';
import {
  CUSTOM_MOVES_MAX, groupsFromSids, normalizeQuotes,
  type MoveInputResult, type PredictPuzzle,
} from './types';

const FACES = PYRA_FACE_LABELS;
const PER_FACE = PYRA_STICKERS_PER_FACE;
const TOTAL = FACES.length * PER_FACE;

/** 四个顶点轴的字母(tnoodle 的 `applyMove` 轴序 = u l r b)。 */
const AXES = ['U', 'L', 'R', 'B'] as const;

/**
 * 金字塔四个面的配色 —— tnoodle 的方案(前绿 底黄 左红 右蓝),用站内色值表达。
 * 正四面体没有对面,U/D/L/R/F/B 那 24 档拿方朝向对它不成立,所以这张表是死的。
 */
const FACE_COLOR = { F: 'F', D: 'D', L: 'R', R: 'B' } as const;

const FACE_NAME = {
  F: { zh: '前', en: 'Front' },
  D: { zh: '底', en: 'Down' },
  L: { zh: '左', en: 'Left' },
  R: { zh: '右', en: 'Right' },
} as const;

/**
 * 尖角贴纸的下标集合 —— 从 `turnTipOnly` 现推,不手抄:只转尖角时动了的格子就是尖角格。
 * (顺带确认了每面的 0/3/6 三格是尖角、1/4/7 是角块、2/5/8 是棱块。)
 */
const TIP_SLOTS: ReadonlySet<number> = (() => {
  const out = new Set<number>();
  for (let axis = 0; axis < 4; axis++) {
    const st = new PyraminxState();
    st.turnTipOnly(axis);
    st.image.flat().forEach((v, i) => { if (v !== i) out.add(i); });
  }
  return out;
})();

const PIECES = groupsFromSids(FACES, PER_FACE, PIECE_GROUPS.pyraminx);

/** 顶点层 token(大写)与尖角 token(小写),都可带撇。 */
const TOKEN_RE = /^([ULRBulrb])('?)$/;

export const pyraminxPuzzle: PredictPuzzle = {
  id: 'pyraminx',
  sim: 'pyraminx',
  faces: FACES,
  perFace: PER_FACE,
  faceColor: FACE_COLOR,
  faceName: FACE_NAME,
  cubeLike: false,
  pieces: PIECES,
  kindOf: (piece) => (
    piece.length === 2 ? 'edge' : piece.every((s) => TIP_SLOTS.has(s)) ? 'tip' : 'corner'
  ),
  trackable: ['corner', 'edge', 'tip'],
  anchors: [], // 四个面全在转,没有不动的块;方位靠场景里的四个顶点字母
  placementMoves: (rnd) => pyraPlacement(14, rnd),
  defaultMoveCount: 5,
  moveCountMax: 20,
  placeholder: "U R' L R",

  apply(perm, moves) {
    const st = new PyraminxState();
    // tnoodle 的 image 携带的是「谁坐在这儿」,拿现成的 perm 当种子直接往下转即可。
    for (let f = 0; f < FACES.length; f++) {
      for (let i = 0; i < PER_FACE; i++) st.image[f][i] = perm[f * PER_FACE + i];
    }
    for (const mv of moves) st.applyMove(mv);
    return st.image.flat();
  },

  randomMoves(count, rnd) {
    // 只出顶点层转:尖角转谁都追得到(它只在原地转),放进题面纯粹是噪音。
    const out: string[] = [];
    let last: string | null = null;
    for (let i = 0; i < count; i++) {
      let axis: string;
      do { axis = AXES[Math.floor(rnd() * AXES.length)]; } while (axis === last);
      last = axis;
      out.push(axis + (rnd() < 0.5 ? '' : "'"));
    }
    return out;
  },

  parse: parsePyraInput,
  moveFace: () => null, // U/L/R/B 是顶点不是面,给转动卡片上「面色」会误导
};

/**
 * 把目标块甩到随机起点位的隐藏乱转:顶点层若干步,末尾补四个尖角转 —— 不补的话
 * 每个尖角的色向恒等于它那个顶点层转过的次数,尖角那一档就成了送分题。
 */
export function pyraPlacement(count: number, rnd: () => number): string[] {
  const out = pyraminxPuzzle.randomMoves(count, rnd);
  for (const axis of AXES) {
    const n = Math.floor(rnd() * 3); // 0 / 1 / 2 次,0 就是不转
    if (n === 1) out.push(axis.toLowerCase());
    else if (n === 2) out.push(`${axis.toLowerCase()}'`);
  }
  return out;
}

/** 自己输入的公式 → 题面那串。收 `U L R B` 与小写尖角,撇 = 逆;别的记号当场拒。 */
export function parsePyraInput(text: string): MoveInputResult {
  const tokens = normalizeQuotes(text).trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { moves: null, error: { kind: 'empty' } };
  if (tokens.length > CUSTOM_MOVES_MAX) return { moves: null, error: { kind: 'tooLong', count: tokens.length } };
  const moves: string[] = [];
  for (const raw of tokens) {
    const m = TOKEN_RE.exec(raw);
    if (!m) return { moves: null, error: { kind: 'token', token: raw } };
    moves.push(m[1] + m[2]);
  }
  return { moves, error: null };
}

export { TIP_SLOTS as PYRA_TIP_SLOTS, TOTAL as PYRA_STICKER_COUNT };
