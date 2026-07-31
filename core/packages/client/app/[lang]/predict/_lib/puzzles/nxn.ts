/**
 * NxN(二 / 四 / 五 / 六 / 七阶)的 /predict 模型。
 *
 * 状态机直接用站内那份 cstimer 移植 `@cuberoot/shared/nnn-sim` 的 `doslice` —— 展开图
 * 预览、镜面魔方图用的同一份,不另写转动表。它的面序是 cstimer 的 D L B U R F,而
 * canonical 贴纸空间是 WCA 的 U R F D L B,两边的换算走 `cubeStickerIdFromPosit`
 * (那也是 `PIECE_GROUPS` / 展开图的 sid 来源),所以这里只建一张下标对照表。
 *
 * **层记号只走 `doslice(face, depth)`,不走 `applyScrambleTo`**:后者把 `3R` 也当成
 * 三层宽(它只服务打乱串,打乱串里不会出现单内层),而 `/sim` 引擎的 `convertAction`
 * 把 `3R` 读成「第 3 层那一片」。两边对不上,题目的答案就会和动画对不上 —— 所以这里
 * 自己把 token 拆成 (面, 层深) 对,与引擎逐条对齐:
 *   `R` = 深 0;`Rw` / `r` = 深 0..1;`kRw` = 深 0..k-1;`kR` = 只有深 k-1。
 */
import {
  doslice, FACE_U, FACE_R, FACE_F, FACE_D, FACE_L, FACE_B, type PositArray,
} from '@cuberoot/shared/nnn-sim';
import { cubeStickerIdFromPosit } from '@cuberoot/shared/cube-unfolded-svg';
import { cubeOnly, expandGroups, tokenizeMoves } from '@cuberoot/shared/alg-notation';
import { PIECE_GROUPS } from '@/lib/puzzle-image/puzzle-mask';
import {
  CUSTOM_MOVES_MAX, groupsFromSids, normalizeQuotes,
  type MoveInputResult, type PredictPieceKind, type PredictPuzzle, type PredictPuzzleId,
} from './types';

/** canonical 面序(= `lib/puzzle-image` 的 `CANONICAL_FACES.cube`)。 */
const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

const CSTIMER_FACE: Record<string, number> = {
  U: FACE_U, R: FACE_R, F: FACE_F, D: FACE_D, L: FACE_L, B: FACE_B,
};

const FACE_NAME = {
  U: { zh: '顶', en: 'Up' },
  R: { zh: '右', en: 'Right' },
  F: { zh: '前', en: 'Front' },
  D: { zh: '底', en: 'Down' },
  L: { zh: '左', en: 'Left' },
  B: { zh: '后', en: 'Back' },
} as const;

const FACE_COLOR = { U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B' } as const;

const TURN_SUFFIXES = ['', "'", '2'] as const;

/** 一步拆成若干「(cstimer 面, 层深)」+ 四分之一圈数;认不出返回 null。 */
interface Slice { face: number; depths: number[]; q: number }

/**
 * 层深列表。`width` 是宽转层数(`Rw` = 2),`single` 是「只转第 k 层」(`3R`)。
 * 两者都钳在 N 以内,和引擎的 `from > N → from = N` 同款。
 */
function depthsOf(N: number, layer: number | undefined, wide: boolean): number[] {
  if (layer === undefined) return wide ? [0, Math.min(1, N - 1)] : [0];
  const k = Math.min(Math.max(layer, 1), N);
  if (!wide) return [k - 1];
  return Array.from({ length: k }, (_, i) => i);
}

/** `R` / `Rw` / `3Rw` / `2R` / `r` → slice;不认的记号返回 null。 */
function parseToken(token: string, N: number): Slice | null {
  const m = /^(\d+)?([URFDLB])(w)?(\d*)('?)$/.exec(token);
  if (!m) return null;
  const face = CSTIMER_FACE[m[2]];
  const amount = (m[4] ? Number(m[4]) : 1) * (m[5] ? -1 : 1);
  const q = ((amount % 4) + 4) % 4;
  if (q === 0) return null;
  return { face, depths: depthsOf(N, m[1] ? Number(m[1]) : undefined, !!m[3]), q };
}

/** 一步的规范写法。宽转恒写成 `Rw` / `3Rw`(带 w),裸的 `3R` 只在自己输入时出现。 */
function renderTurn(face: string, width: number, suffix: string): string {
  const head = width === 1 ? face : width === 2 ? `${face}w` : `${width}${face}w`;
  return head + suffix;
}

export function makeNxnPuzzle(N: number): PredictPuzzle {
  const s2 = N * N;
  const total = 6 * s2;

  // posit 下标 ↔ canonical 下标。canonical = 面序号 * N² + 面内行主序,和
  // `buildFaceletMap(N)`(题板寻址)、`PIECE_GROUPS.cube{N}` 逐格同一空间。
  const positToCanon = new Int32Array(total);
  const canonToPosit = new Int32Array(total);
  for (let p = 0; p < total; p++) {
    const sid = cubeStickerIdFromPosit(N, p);
    const c = FACES.indexOf(sid[0] as typeof FACES[number]) * s2 + Number(sid.slice(1));
    positToCanon[p] = c;
    canonToPosit[c] = p;
  }

  const groups = PIECE_GROUPS[`cube${N}`];
  const pieces = groups ? groupsFromSids(FACES, s2, groups) : derivePieces(N, s2);

  const trackable: PredictPieceKind[] = N === 2 ? ['corner'] : ['corner', 'edge', 'center'];

  /** 随机题面公式。宽转层数最多到 N/2 —— 再宽就等于反面的窄转,只是换个写法。 */
  const randomMoves = (count: number, rnd: () => number): string[] => {
    const maxWidth = Math.max(1, Math.floor(N / 2));
    const out: string[] = [];
    let last: string | null = null;
    for (let i = 0; i < count; i++) {
      let face: string;
      do { face = FACES[Math.floor(rnd() * FACES.length)]; } while (face === last);
      last = face;
      const width = 1 + Math.floor(rnd() * maxWidth);
      out.push(renderTurn(face, width, TURN_SUFFIXES[Math.floor(rnd() * TURN_SUFFIXES.length)]));
    }
    return out;
  };

  return {
    id: String(N) as PredictPuzzleId,
    sim: N,
    faces: FACES,
    perFace: s2,
    faceColor: FACE_COLOR,
    faceName: FACE_NAME,
    cubeLike: true,
    pieces,
    kindOf: (piece) => (piece.length >= 3 ? 'corner' : piece.length === 2 ? 'edge' : 'center'),
    trackable,
    // 奇数阶的六个中心不动,留作方位锚;偶数阶没有固定块,靠场景里的面字母认方位。
    anchors: N % 2 === 1 ? FACES.map((_, f) => f * s2 + (s2 - 1) / 2) : [],
    defaultMoveCount: 6,
    moveCountMax: 20,
    placeholder: N >= 4 ? "R U Rw' U'" : "R U R' U'",

    apply(perm, moves) {
      const pos: PositArray = new Int32Array(total);
      for (let i = 0; i < total; i++) pos[i] = perm[positToCanon[i]];
      for (const mv of moves) {
        const s = parseToken(mv, N);
        if (!s) continue;
        for (const d of s.depths) doslice(s.face, d, s.q, N, pos);
      }
      const out = new Array<number>(total);
      for (let i = 0; i < total; i++) out[positToCanon[i]] = pos[i];
      return out;
    },

    randomMoves,
    // 起点乱转:阶数越高越要多转几步,否则大片还原区留在盘面上,题目会露馅。
    placementMoves: (rnd) => randomMoves(N <= 2 ? 11 : N === 3 ? 15 : 10 * N, rnd),

    parse: (text) => parseNxnInput(text, N),
    // 三阶那档的输入其实走 `../challenge.ts` 的 parseMoveInput(它连宽转都不收),
    // 所以这句话按那边的实际口径写,别照抄下面这条。
    notation: N === 3
      ? {
        zh: "只收 U R F D L B(可加 ' 或 2);宽转 r / Rw、中层 M E S、转体 x y z 都追不了。",
        en: "Only U R F D L B (each with an optional ' or 2) — no wide turns, slices or rotations.",
      }
      : {
        zh: "只收 U R F D L B,可带宽转前缀(Rw / 2R / 3Rw)与 ' / 2;中层 M E S、转体 x y z 追不了。",
        en: "Only U R F D L B, optionally with a layer prefix (Rw / 2R / 3Rw) and ' / 2 — no slices or rotations.",
      },
    moveFace: (move) => /([URFDLB])/.exec(move)?.[1] ?? null,
  };
}

/**
 * 自己输入的公式 → 题面那串。
 *
 * 文法走站内唯一那份 3x3 记号真源 `@cuberoot/shared/alg-notation`(连写 `RUR'U'`、
 * `(R U)2`、`// 注释` 都吃),这里只做本拼图的闸:
 *   · 收 face(`R`)与 wide(`Rw` / `r` / `3Rw` / `3R`);
 *   · 拒 slice(`M/E/S`)与转体(`x/y/z`)—— 判定层的 `doslice` 没有它们,悄悄按
 *     别的意思解释出的题答案就是错的;
 *   · 拒层区间(`2-3R`):`doslice` 与引擎对区间的读法不一致,不如当场说不认。
 */
export function parseNxnInput(text: string, N: number): MoveInputResult {
  const src = normalizeQuotes(text);
  const bracket = /\[[^\]]*\]?/.exec(src);
  if (bracket) return { moves: null, error: { kind: 'token', token: bracket[0] } };

  let flat: string;
  try {
    flat = expandGroups(cubeOnly(src));
  } catch {
    return { moves: null, error: { kind: 'parens' } };
  }
  const { moves: parsed, junk } = tokenizeMoves(flat);
  if (junk.length) return { moves: null, error: { kind: 'token', token: junk[0] } };
  if (parsed.length === 0) return { moves: null, error: { kind: 'empty' } };
  if (parsed.length > CUSTOM_MOVES_MAX) return { moves: null, error: { kind: 'tooLong', count: parsed.length } };

  const moves: string[] = [];
  for (const m of parsed) {
    if (m.kind !== 'face' && m.kind !== 'wide') return { moves: null, error: { kind: 'token', token: m.raw } };
    if (m.layer?.includes('-')) return { moves: null, error: { kind: 'token', token: m.raw } };
    // 小写宽转 `r` = `Rw`;数字前缀原样带上(`3Rw` / `3R` 语义不同,都保留)。
    const base = m.family.replace(/w$/, '');
    const wide = m.family.endsWith('w') || /[rludfb]/.test(base);
    const face = base.toUpperCase();
    if (!(face in CSTIMER_FACE)) return { moves: null, error: { kind: 'token', token: m.raw } };
    const layer = m.layer ? Number(m.layer) : undefined;
    if (layer !== undefined && layer > N) return { moves: null, error: { kind: 'token', token: m.raw } };
    // 转满一圈 = 没动过(tokenizer 照写不折 mod 4,那是给指法/动画算数用的)。
    const amount = ((m.amount % 4) + 4) % 4;
    if (amount === 0) continue;
    const suffix = amount === 2 ? '2' : amount === 3 ? "'" : '';
    const head = layer !== undefined
      ? `${layer}${face}${wide ? 'w' : ''}`
      : wide ? `${face}w` : face;
    moves.push(head + suffix);
  }
  return moves.length ? { moves, error: null } : { moves: null, error: { kind: 'empty' } };
}

/**
 * `PIECE_GROUPS` 没有这个阶数时的兜底:同一颗小方块的贴纸按坐标聚在一起。
 * (目前 2..7 都有表,这条只是别让阶数一超就整页崩。)
 */
function derivePieces(N: number, s2: number): number[][] {
  const byCubie = new Map<string, number[]>();
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < s2; i++) {
      const row = Math.floor(i / N);
      const col = i % N;
      const key = cubieKey(N, f, row, col);
      const arr = byCubie.get(key) ?? [];
      arr.push(f * s2 + i);
      byCubie.set(key, arr);
    }
  }
  return [...byCubie.values()];
}

/** 贴纸 (面, 行, 列) → 它所属小方块的整数坐标(x,y,z),用来把同块贴纸聚成一组。 */
function cubieKey(N: number, face: number, row: number, col: number): string {
  const m = N - 1;
  switch (FACES[face]) {
    case 'U': return `${col},${m},${row}`;
    case 'R': return `${m},${m - row},${m - col}`;
    case 'F': return `${col},${m - row},${m}`;
    case 'D': return `${col},0,${m - row}`;
    case 'L': return `0,${m - row},${col}`;
    default: return `${m - col},${m - row},0`;
  }
}
