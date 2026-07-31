/**
 * 斜转魔方的 /predict 模型。
 *
 * 记号取 **WCA Regulations #12h** 的四个角:`R`=DRB `U`=ULB `L`=DLF `B`=DLB,撇 = 逆
 * (order-3,所以撇 = 同向转两次)。`/sim` 引擎的 skewb 用的正是这一组角,题面那串原样
 * 喂给引擎就能播动画;两边是不是同一个物理转动,由 tests/predict_puzzles.test.ts 拿引擎
 * 几何逐格核对。
 *
 * 状态机因此走 `@cuberoot/shared/skewb-pyramid-svg` 的 `SkewbStateWCA`,**不是**
 * `skewb_svg.ts` 里那份 tnoodle 的 `SkewbState` —— 后者虽然贴纸布局一模一样(所以
 * `PIECE_GROUPS` / `ENGINE_SID_MAP` 两张表通用),但它给四个轴取的是**另外四个角**
 * (R=DRF U=URB L=DLB B=DRB),同一个字母是不同的物理转动。踩过:直接拿它出题,盘面
 * 转的和答案算的不是一回事,而且屏幕上看不出来。
 *
 * 引擎另外还认 `F D UL UR`(另外四个角)和转体 `x y z`。前者模型也支持,但出题不用 ——
 * WCA 打乱只用那四个字母;转体不改状态、只换手,对「落在哪一格」没有意义。
 */
import { SkewbStateWCA } from '@cuberoot/shared/skewb-pyramid-svg';
import { SKEWB_FACE_LABELS, SKEWB_STICKERS_PER_FACE } from '@/app/[lang]/scramble/gen/_svg/skewb_svg';
import { PIECE_GROUPS } from '@/lib/puzzle-image/puzzle-mask';
import {
  CUSTOM_MOVES_MAX, groupsFromSids, normalizeQuotes,
  type MoveInputResult, type PredictPuzzle,
} from './types';

const FACES = SKEWB_FACE_LABELS;
const PER_FACE = SKEWB_STICKERS_PER_FACE;

/** WCA 打乱用的四个角。 */
const AXES = ['R', 'U', 'L', 'B'] as const;

const FACE_COLOR = { U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B' } as const;

const FACE_NAME = {
  U: { zh: '顶', en: 'Up' },
  R: { zh: '右', en: 'Right' },
  F: { zh: '前', en: 'Front' },
  D: { zh: '底', en: 'Down' },
  L: { zh: '左', en: 'Left' },
  B: { zh: '后', en: 'Back' },
} as const;

const TOKEN_RE = /^([RULB])('?)$/;

export const skewbPuzzle: PredictPuzzle = {
  id: 'skewb',
  sim: 'skewb',
  faces: FACES,
  perFace: PER_FACE,
  faceColor: FACE_COLOR,
  faceName: FACE_NAME,
  cubeLike: true,
  pieces: groupsFromSids(FACES, PER_FACE, PIECE_GROUPS.skewb),
  kindOf: (piece) => (piece.length >= 3 ? 'corner' : 'center'),
  trackable: ['corner', 'center'],
  anchors: [], // 斜转的六个中心也会跑,没有不动的块;方位靠场景里的面字母
  placementMoves: (rnd) => skewbPuzzle.randomMoves(12, rnd),
  defaultMoveCount: 5,
  moveCountMax: 20,
  placeholder: "R U R' U'",

  apply(perm, moves) {
    const st = new SkewbStateWCA();
    for (let f = 0; f < FACES.length; f++) {
      for (let i = 0; i < PER_FACE; i++) st.image[f][i] = perm[f * PER_FACE + i];
    }
    for (const mv of moves) st.applyMove(mv);
    return st.image.flat();
  },

  randomMoves(count, rnd) {
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

  parse: parseSkewbInput,
  moveFace: () => null, // R/U/L/B 是角不是面,给转动卡片上「面色」会误导
};

/** 自己输入的公式 → 题面那串。只收 `R U L B`(可加撇);别的记号当场拒。 */
export function parseSkewbInput(text: string): MoveInputResult {
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
