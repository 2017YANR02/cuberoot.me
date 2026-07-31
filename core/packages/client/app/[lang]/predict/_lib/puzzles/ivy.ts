/**
 * 枫叶魔方(Ivy Cube)的 /predict 模型。
 *
 * 枫叶只有 4 个可转角 + 6 个中心,一共 18 枚贴纸(每面 1 枚透镜 + 2 枚花瓣),太小,
 * `lib/puzzle-image` 那两张派生表(块分组 / 引擎贴纸直映)都没给它做。所以这里自己
 * 定义 canonical 贴纸空间,但**转动仍然只有一个真源**:`lib/ivy-solver` 的
 * `MOVE_CENTERS`(中心 3-循环)+ 角色向,与 `/scramble/gen/_svg/ivy_svg` 画预览图用的
 * 是同一份;花瓣落色的算法也照抄它的 `cornerColorId`,免得两处对「色向 +1 是往哪转」
 * 各有一套。
 *
 * canonical 贴纸下标 = `面 * 3 + 槽`,面序 U R F B L D(= ivy-solver 的面序),
 * 槽 0 = 透镜(中心块),槽 1 / 2 = 该面两个可转角的花瓣,按轴序号升序。
 *
 * 记号取 **`/sim` 引擎那一套**(裸字母 = 一次 120° 扭转),不是 ivy-solver 的 cstimer
 * 记号(裸字母 = 转两次)—— 题面那串要原样喂给引擎播动画,记号必须跟引擎一致。
 */
import { MOVE_CENTERS } from '@/lib/ivy-solver';
import {
  CUSTOM_MOVES_MAX, identityPerm, normalizeQuotes,
  type MoveInputResult, type PredictPuzzle,
} from './types';

/** 面序 = lib/ivy-solver 的 `centers` 下标。 */
const FACES = ['U', 'R', 'F', 'B', 'L', 'D'] as const;
const PER_FACE = 3;
const TOTAL = FACES.length * PER_FACE;

/** 可转角字母,与 `/sim` 的 `IvyTwister` / ivy-solver 同序。 */
const AXES = ['R', 'L', 'D', 'B'] as const;

const FACE_COLOR = { U: 'U', R: 'R', F: 'F', B: 'B', L: 'L', D: 'D' } as const;

const FACE_NAME = {
  U: { zh: '顶', en: 'Up' },
  R: { zh: '右', en: 'Right' },
  F: { zh: '前', en: 'Front' },
  B: { zh: '后', en: 'Back' },
  L: { zh: '左', en: 'Left' },
  D: { zh: '底', en: 'Down' },
} as const;

/** 每个面挨着的两个可转角(轴序号升序)。 */
const FACE_AXES: readonly (readonly number[])[] = FACES.map((_, f) =>
  MOVE_CENTERS.flatMap((tri, axis) => (tri.includes(f) ? [axis] : [])),
);

/** (面, 轴) → 该花瓣在这一面里的槽号(1 或 2)。 */
export function ivyPetalSlot(face: number, axis: number): number {
  return 1 + FACE_AXES[face].indexOf(axis);
}

/** (面, 轴) → canonical 贴纸下标。 */
export const ivyPetalIndex = (face: number, axis: number): number =>
  face * PER_FACE + ivyPetalSlot(face, axis);

/** 面 → 它那枚透镜(中心块)的 canonical 贴纸下标。 */
export const ivyLensIndex = (face: number): number => face * PER_FACE;

const PIECES: number[][] = [
  // 4 个可转角:每个角在它那三个面上各有一枚花瓣。
  ...MOVE_CENTERS.map((tri, axis) => tri.map((f) => ivyPetalIndex(f, axis))),
  // 6 个中心:各一枚透镜。
  ...FACES.map((_, f) => [ivyLensIndex(f)]),
];

const TOKEN_RE = /^([RLDB])('?)$/;

/** 一次基础扭转(ivy-solver 的 base turn):中心按 `MOVE_CENTERS` 三循环 + 该角色向 +1。 */
function baseTurn(centers: number[], corners: number[], axis: number): void {
  const [a, b, c] = MOVE_CENTERS[axis];
  const va = centers[a], vb = centers[b], vc = centers[c];
  centers[b] = va;
  centers[c] = vb;
  centers[a] = vc;
  corners[axis] = (corners[axis] + 1) % 3;
}

/** (centers, corners) → perm[slot] = 坐在这一格里的贴纸的本位下标。 */
function stateToPerm(centers: readonly number[], corners: readonly number[]): number[] {
  const perm = new Array<number>(TOTAL);
  for (let f = 0; f < FACES.length; f++) {
    // 透镜:这一面现在坐着哪个中心块,就显示那个中心块的透镜。
    perm[ivyLensIndex(f)] = ivyLensIndex(centers[f]);
    for (const axis of FACE_AXES[f]) {
      // 花瓣:角 `axis` 转过 ori 次后,坐在 f 面的是它本位在 tri[(p−ori) mod 3] 面的那一枚
      //(与 ivy_svg 的 cornerColorId 同一条式子)。
      const tri = MOVE_CENTERS[axis];
      const p = tri.indexOf(f);
      const home = tri[(p - corners[axis] + 3) % 3];
      perm[ivyPetalIndex(f, axis)] = ivyPetalIndex(home, axis);
    }
  }
  return perm;
}

export const ivyPuzzle: PredictPuzzle = {
  id: 'ivy',
  sim: 'ivy',
  faces: FACES,
  perFace: PER_FACE,
  faceColor: FACE_COLOR,
  faceName: FACE_NAME,
  cubeLike: true,
  pieces: PIECES,
  kindOf: (piece) => (piece.length >= 3 ? 'corner' : 'center'),
  trackable: ['corner', 'center'],
  anchors: [], // 中心块也会跑,没有不动的块;方位靠场景里的面字母
  placementMoves: (rnd) => ivyPuzzle.randomMoves(10, rnd),
  defaultMoveCount: 5,
  moveCountMax: 20,
  placeholder: "R L' D B",

  apply(perm, moves) {
    const centers = [0, 1, 2, 3, 4, 5];
    const corners = [0, 0, 0, 0];
    for (const raw of moves) {
      const m = TOKEN_RE.exec(raw);
      if (!m) continue;
      const axis = AXES.indexOf(m[1] as typeof AXES[number]);
      if (axis < 0) continue;
      // 引擎记号:裸字母 = 一次 120°,撇 = 它的逆 = 转两次。
      const times = m[2] ? 2 : 1;
      for (let t = 0; t < times; t++) baseTurn(centers, corners, axis);
    }
    const step = stateToPerm(centers, corners);
    return step.map((home) => perm[home]);
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

  notation: {
    zh: "只收 R L D B(可加 ',四个可转角)。",
    en: "Only R L D B (the four turnable corners, optional ').",
  },
  parse: parseIvyInput,
  moveFace: () => null, // R/L/D/B 是可转角不是面
};

/** 还原态的 perm,给测试与调用方当种子。 */
export const ivySolvedPerm = (): number[] => identityPerm(TOTAL);

/** 自己输入的公式 → 题面那串。只收 `R L D B`(可加撇)。 */
export function parseIvyInput(text: string): MoveInputResult {
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

export { TOTAL as IVY_STICKER_COUNT, FACE_AXES as IVY_FACE_AXES, AXES as IVY_AXES };
