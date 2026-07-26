/**
 * /predict 出题引擎 —— 「这枚贴纸转完落在哪」的纯逻辑层。
 *
 * 出题分三步:
 *   1. 按模式挑一枚(或一对 / 一组)目标块,并在它的贴纸里选一枚要追踪的;
 *   2. 用一段隐藏的 15 步乱转把它甩到魔方上的随机位置 —— 这就是屏幕上看到的起点;
 *   3. 生成题面招式,算出那枚贴纸最终落在哪个 facelet 上,那就是唯一正确答案。
 *
 * 魔方模型直接用 `lib/lsll/cube333`(kociemba 编号,已被 tests/lsll_model.test.ts
 * 对齐 cubing.js 与 visualcube),不另造一套。facelet 序 = visualcube fd 序
 * (U0-8 R9-17 F18-26 D27-35 L36-44 B45-53),和 3D 板子的 facelet map 同序。
 *
 * 颜色与朝向解耦:这里全程只认「本位面」(0=U 1=R 2=F 3=D 4=L 5=B),朝向前缀
 * 只在最后把本位面翻译成显示颜色(见 lib/cube-orientation)。所以换朝向不会
 * 改变答案,只改变屏幕上的颜色和题面里念的颜色名。
 */
import {
  solvedCube, applyAlg, toFacelets, cornerFaceletIdx, edgeFaceletIdx,
  CORNER_COLORS, EDGE_COLORS, type Cube333,
} from '@/lib/lsll/cube333';
import { cubeOnly, expandGroups, tokenizeMoves } from '@cuberoot/shared/alg-notation';
import type { CubeFace } from '@/lib/cube-colors';
import { orientedFaceColors, faceShowingColor } from '@/lib/cube-orientation';
import { F2L_ALGS } from './f2l_algs';

/** 本位面序号 → 面字母(与 cube333 的 FACE_CH 同序)。 */
export const FACE_LETTERS: readonly CubeFace[] = ['U', 'R', 'F', 'D', 'L', 'B'];
/** 对面。 */
const OPPOSITE = [3, 4, 5, 0, 1, 2];

export type PredictMode = 'normal' | 'cross' | 'twoLayers' | 'f2l';
export type PieceKind = 'edge' | 'corner' | 'pair';
export type ScrambleSource = 'random' | 'f2lAlg' | 'custom';

export const MOVE_COUNT_MIN = 1;
export const MOVE_COUNT_MAX = 20;
export const CROSS_EDGES_MIN = 1;
export const CROSS_EDGES_MAX = 4;
/** 自己输入的公式最多几步 —— 追踪一枚贴纸再长也没意义,而且题面那排卡片会溢出。 */
export const CUSTOM_MOVES_MAX = 40;

/** 目标块被甩到起点位置用的隐藏乱转步数(与被复刻的原站一致)。 */
const PLACEMENT_MOVES = 15;

const TURN_FACES = ['R', 'L', 'U', 'D', 'F', 'B'] as const;
const TURN_SUFFIXES = ['', "'", '2'] as const;

export interface PredictTarget {
  kind: 'corner' | 'edge';
  /** cube333 的块序号。 */
  piece: number;
  /** 该块自己的贴纸编号(0 = 本位在 U/D 或 F/B 的那枚)。 */
  sticker: number;
  /** 要追踪的那枚贴纸的本位面序号 —— 显示颜色由朝向决定。 */
  colorFace: number;
  /** 出题时这枚贴纸所在的 facelet(屏幕上高亮的位置)。 */
  startFacelet: number;
  /** 招式做完后它落在的 facelet —— 唯一正确答案。 */
  answerFacelet: number;
}

export interface PredictChallenge {
  /** 题面招式 —— 玩家要在脑子里做的那串。 */
  moves: string[];
  /** 把目标块甩到起点位的隐藏乱转;题面不展示,留给复盘/测试重建盘面。 */
  placement: string[];
  targets: PredictTarget[];
  /**
   * 起始盘面 54 格的真实颜色(面字母)。整盘都画出来,只是非目标格压暗
   * (/sim 阶段遮罩那档 dim:保留各自颜色减半),所以这里必须是全色而非「灰底」。
   */
  startColors: string;
  /**
   * 哪几格满色 = 目标块整块的贴纸,其余 '.'(压暗)。
   * **不含中心**:整盘颜色都在了,中心不再需要当参照系,它满色只会跟目标抢眼。
   */
  startFacelets: string;
}

export interface PredictOptions {
  mode: PredictMode;
  kind: PieceKind;
  moveCount: number;
  source: ScrambleSource;
  /** cross 模式下要找几条棱(1..4)。 */
  crossEdges: number;
  /** 拿方朝向前缀,'' = (UF)。 */
  orientation: string;
  /** source='custom' 时用它当题面,已经过 `parseMoveInput`。空 = 一步不转(答案就在原地)。 */
  customMoves?: readonly string[];
  /** 注入随机源,测试里可给确定性实现。 */
  random?: () => number;
}

const pick = <T,>(arr: readonly T[], rnd: () => number): T => arr[Math.floor(rnd() * arr.length)];

function sample<T>(arr: readonly T[], count: number, rnd: () => number): T[] {
  const pool = [...arr];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/** 一枚贴纸在给定状态下落在哪个 facelet。 */
export function stickerFacelet(state: Cube333, kind: 'corner' | 'edge', piece: number, sticker: number): number {
  if (kind === 'corner') {
    for (let i = 0; i < 8; i++) {
      if (state.cp[i] === piece) return cornerFaceletIdx(i)[(sticker + state.co[i]) % 3];
    }
  } else {
    for (let i = 0; i < 12; i++) {
      if (state.ep[i] === piece) return edgeFaceletIdx(i)[(sticker + state.eo[i]) % 2];
    }
  }
  throw new Error(`piece ${kind}/${piece} not found`);
}

/** 一个块的全部贴纸落点。 */
function pieceFacelets(state: Cube333, kind: 'corner' | 'edge', piece: number): number[] {
  const n = kind === 'corner' ? 3 : 2;
  return Array.from({ length: n }, (_, k) => stickerFacelet(state, kind, piece, k));
}

/** facelet 序号 → 它在哪个面(URFDLB 分段,与 FACE_LETTERS 同序)。 */
export const faceletFace = (facelet: number): number => Math.floor(facelet / 9);

/** 目标块整块的贴纸 → 面字母(= 满色那几格),其余 '.'(压暗)。 */
function paintPieces(state: Cube333, picks: readonly { kind: 'corner' | 'edge'; piece: number }[]): string {
  const out = Array<string>(54).fill('.');
  for (const p of picks) {
    const colors = p.kind === 'corner' ? cornerColorsOf(p.piece) : edgeColorsOf(p.piece);
    for (const [k, f] of pieceFacelets(state, p.kind, p.piece).entries()) {
      out[f] = FACE_LETTERS[colors[k]];
    }
  }
  return out.join('');
}

const cornerColorsOf = (piece: number): readonly number[] => CORNER_COLORS[piece];
const edgeColorsOf = (piece: number): readonly number[] => EDGE_COLORS[piece];

/** 随机招式:相邻两步不同面(与被复刻的原站同规则)。 */
export function randomMoves(count: number, rnd: () => number): string[] {
  const out: string[] = [];
  let last: string | null = null;
  for (let i = 0; i < count; i++) {
    let face: string;
    do { face = pick(TURN_FACES, rnd); } while (face === last);
    last = face;
    out.push(face + pick(TURN_SUFFIXES, rnd));
  }
  return out;
}

export type MoveInputError =
  | { kind: 'empty' }
  | { kind: 'token'; token: string }
  | { kind: 'parens' }
  | { kind: 'tooLong'; count: number };

export type MoveInputResult =
  | { moves: string[]; error: null }
  | { moves: null; error: MoveInputError };

/**
 * 玩家自己输入的公式 → 题面那串。
 *
 * **文法不在这里** —— 切词、剥注释/换握记号、展开 `(...)N` 全走站内那份唯一的 3x3 记号真源
 * `@cuberoot/shared/alg-notation`(recon 计步、镜像、alg 库校验用的同一份)。这里只做这块
 * 板子自己的那一道闸:**判定层 `applyAlg` 只有六个外层面转**,所以 tokenizer 标成 wide /
 * slice / rotation 的一律当场拒、把那个词原样退回去 —— 悄悄按别的意思解释(比如把宽转 `r`
 * 当 `R`),出的题答案就是错的,盘面上还看不出来。
 *
 * 于是收下的比自己写文法时还多:连写 `RUR'U'`、`(R U)2`、`// 注释`、`·` 换握记号都能吃。
 * 换位子 `[R, U]` 例外 —— `[...]` 在站内是 FTN 注解块,`cubeOnly` 会整块剥掉,不拦的话
 * 它会静悄悄变成空公式,所以先点名拦下。输出统一成 `R` / `R'` / `R2`。
 *
 * 括号走 `expandGroups` 的**严格**档(不是宽容的 `flattenAlg`):括号没配对时后者会把括号
 * 连重复次数一起丢掉 —— `(R U)2 F` 少一个括号就变成 `R U F`,少转一整遍还没人报。而输入框
 * 打 `(` 会自动补 `)`,自己再打一个右括号就多出来了,这条路很好走。
 */
export function parseMoveInput(text: string): MoveInputResult {
  // 弯引号(网页 / 中文输入法粘出来的)→ ASCII:记号文法只认 '
  const src = text.replace(/[’‘`´′]/g, "'");
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
    if (m.kind !== 'face') return { moves: null, error: { kind: 'token', token: m.raw } };
    // tokenizer 照写不折 mod 4(`R4` 对指法/动画算数),但这块板子只问贴纸落在哪,
    // 转满一圈 = 没动过。
    const amount = ((m.amount % 4) + 4) % 4;
    if (amount === 0) continue;
    moves.push(m.family + (amount === 2 ? '2' : amount === 3 ? "'" : ''));
  }
  return moves.length ? { moves, error: null } : { moves: null, error: { kind: 'empty' } };
}

interface PiecePools {
  corners: number[];
  edges: number[];
  /** f2l 槽:白角 + 同两侧色的中层棱。 */
  slots: { corner: number; edge: number }[];
  /** 允许追踪的本位面(null = 不限)。 */
  allowedColors: number[] | null;
}

function poolsFor(mode: PredictMode, crossFace: number): PiecePools {
  const allCorners = [0, 1, 2, 3, 4, 5, 6, 7];
  const allEdges = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const lastLayer = OPPOSITE[crossFace];

  if (mode === 'cross') {
    const edges = allEdges.filter((e) => edgeColorsOf(e).includes(crossFace));
    return { corners: [], edges, slots: [], allowedColors: [crossFace] };
  }
  if (mode === 'f2l') {
    const slots = allCorners
      .filter((c) => cornerColorsOf(c).includes(crossFace))
      .map((c) => {
        const sides = cornerColorsOf(c).filter((f) => f !== crossFace);
        const edge = allEdges.find((e) => {
          const ec = edgeColorsOf(e);
          return ec.length === 2 && sides.every((f) => ec.includes(f));
        });
        return { corner: c, edge: edge as number };
      });
    return { corners: slots.map((s) => s.corner), edges: slots.map((s) => s.edge), slots, allowedColors: null };
  }
  if (mode === 'twoLayers') {
    return {
      corners: allCorners.filter((c) => !cornerColorsOf(c).includes(lastLayer)),
      edges: allEdges.filter((e) => !edgeColorsOf(e).includes(lastLayer)),
      slots: [],
      allowedColors: null,
    };
  }
  return { corners: allCorners, edges: allEdges, slots: [], allowedColors: null };
}

/** 在一个块的贴纸里选要追踪的那枚。`avoid` 用来让「一对」的两枚颜色不撞。 */
function chooseSticker(
  colors: readonly number[], allowed: number[] | null, avoid: number | null, rnd: () => number,
): number {
  let idx = colors.map((_, k) => k);
  if (allowed) {
    const narrowed = idx.filter((k) => allowed.includes(colors[k]));
    if (narrowed.length) idx = narrowed;
  }
  if (avoid !== null) {
    const narrowed = idx.filter((k) => colors[k] !== avoid);
    if (narrowed.length) idx = narrowed;
  }
  return pick(idx, rnd);
}

/**
 * 出一道题。
 *
 * `mode` 决定块池,`kind` 决定追踪棱 / 角 / 一对(cross 模式恒为棱,可多枚)。
 */
export function generateChallenge(opts: PredictOptions): PredictChallenge {
  const rnd = opts.random ?? Math.random;
  const shown = orientedFaceColors(opts.orientation);
  // 十字色恒为白;它贴在哪个本位面由朝向决定。
  const crossFace = FACE_LETTERS.indexOf(faceShowingColor(shown, 'U'));
  const pools = poolsFor(opts.mode, crossFace);

  const kind: PieceKind = opts.mode === 'cross' ? 'edge' : opts.kind;
  const picks: { kind: 'corner' | 'edge'; piece: number; sticker: number }[] = [];

  if (opts.mode === 'cross') {
    const count = Math.min(Math.max(opts.crossEdges, CROSS_EDGES_MIN), pools.edges.length);
    for (const piece of sample(pools.edges, count, rnd)) {
      picks.push({ kind: 'edge', piece, sticker: edgeColorsOf(piece).indexOf(crossFace) });
    }
  } else if (opts.mode === 'f2l') {
    const slot = pick(pools.slots, rnd);
    if (kind !== 'edge') {
      picks.push({ kind: 'corner', piece: slot.corner, sticker: chooseSticker(cornerColorsOf(slot.corner), null, null, rnd) });
    }
    if (kind !== 'corner') {
      const avoid = picks.length ? cornerColorsOf(slot.corner)[picks[0].sticker] : null;
      picks.push({ kind: 'edge', piece: slot.edge, sticker: chooseSticker(edgeColorsOf(slot.edge), null, avoid, rnd) });
    }
  } else {
    if (kind !== 'edge') {
      const piece = pick(pools.corners, rnd);
      picks.push({ kind: 'corner', piece, sticker: chooseSticker(cornerColorsOf(piece), pools.allowedColors, null, rnd) });
    }
    if (kind !== 'corner') {
      const piece = pick(pools.edges, rnd);
      const avoid = picks.length ? cornerColorsOf(picks[0].piece)[picks[0].sticker] : null;
      picks.push({ kind: 'edge', piece, sticker: chooseSticker(edgeColorsOf(piece), pools.allowedColors, avoid, rnd) });
    }
  }

  const placement = randomMoves(PLACEMENT_MOVES, rnd);
  const start = applyAlg(solvedCube(), placement.join(' '));

  // custom 那档的合法性在 `parseMoveInput` 就判掉了(UI 不合法压根不出题);
  // 这里只兜住长度,喂进 applyAlg 的必须是它认得的六个面转。
  const moves = opts.source === 'custom'
    ? [...(opts.customMoves ?? [])].slice(0, CUSTOM_MOVES_MAX)
    : opts.source === 'f2lAlg'
      ? pick(F2L_ALGS, rnd).split(' ').filter(Boolean)
      : randomMoves(Math.min(Math.max(opts.moveCount, MOVE_COUNT_MIN), MOVE_COUNT_MAX), rnd);
  const end = applyAlg(start, moves.join(' '));

  const targets: PredictTarget[] = picks.map((p) => {
    const colors = p.kind === 'corner' ? cornerColorsOf(p.piece) : edgeColorsOf(p.piece);
    return {
      kind: p.kind,
      piece: p.piece,
      sticker: p.sticker,
      colorFace: colors[p.sticker],
      startFacelet: stickerFacelet(start, p.kind, p.piece, p.sticker),
      answerFacelet: stickerFacelet(end, p.kind, p.piece, p.sticker),
    };
  });

  return {
    moves,
    placement,
    targets,
    // toFacelets 出的是小写(cube333 内部记号),这里统一成 CubeFace 的大写面字母。
    startColors: toFacelets(start).toUpperCase(),
    startFacelets: paintPieces(start, picks),
  };
}
