/**
 * /predict 的「拼图」抽象 —— 三阶之外那几种(NxN / 金字塔 / 斜转 / 枫叶)共用的契约。
 *
 * 全部按**贴纸置换**说话,不按块的 perm/ori 说话:
 *   `perm[slot] = 坐在这一格里的贴纸的本位下标`
 * 于是「这枚贴纸转完落在哪」= 在新的 perm 里找它的下标,和拼图是什么毫无关系。仓库里
 * 四种拼图的纯状态模型恰好都已经是这个形状(tnoodle 的 `image` / cstimer 的 `posit` 都
 * 带贴纸 id),所以这一层是**接线**而不是新写状态机 —— 别在这儿再造一份转动表。
 *
 * canonical 贴纸下标 = `面序号 * perFace + 面内序号`,面序按各拼图的 `faces`。这与
 * `lib/puzzle-image` 的 canonical sid 空间(`U0` / `F3`)逐格同构,所以块分组表
 * `PIECE_GROUPS`、引擎贴纸直映表 `ENGINE_SID_MAP` 都能直接查 —— 换个 id 空间就得
 * 自己再推一遍这两张表,别换。
 *
 * 三阶不走这里:它的出题还带十字 / 前两层 / F2L 那三档方法学模式,引擎在 `../challenge.ts`。
 */
import type { PuzzleKind } from '@/app/[lang]/sim/engine/world';
import type { PredictColor } from '../colors';

/** URL 上的拼图值。数字 = NxN 的阶;三阶('3')走 `../challenge.ts` 那套。 */
export type PredictPuzzleId =
  '2' | '3' | '4' | '5' | '6' | '7' | 'pyraminx' | 'skewb' | 'ivy' | 'megaminx';

/** 追踪对象的块类别。'pair' 不在这里 —— 那是「同时追两枚」的出题选项,不是块本身。 */
export type PredictPieceKind = 'corner' | 'edge' | 'center' | 'tip';

/** 自己输入公式没通过检查的原因(与 `../challenge.ts` 同一套,那边 re-export)。 */
export type MoveInputError =
  | { kind: 'empty' }
  | { kind: 'token'; token: string }
  | { kind: 'parens' }
  | { kind: 'tooLong'; count: number };

export type MoveInputResult =
  | { moves: string[]; error: null }
  | { moves: null; error: MoveInputError };

/** 自己输入的公式最多几步 —— 再长追不动,题面那排卡片也会溢出。 */
export const CUSTOM_MOVES_MAX = 40;

/** 一个方位字母:贴在拼图外侧的标签 + 它朝哪儿(引擎坐标系的方向,不必归一)。 */
export interface PredictFaceHint {
  letter: string;
  dir: readonly [number, number, number];
}

export interface PredictPuzzle {
  id: PredictPuzzleId;
  /** 喂 `/sim` 引擎的拼图类型(NxN 就是阶数)。 */
  sim: PuzzleKind;
  /** canonical 面字母,顺序即面序号。 */
  faces: readonly string[];
  /** 每面几枚贴纸。 */
  perFace: number;
  /** 面字母 → 显示色号(`../colors`)。立方体族是恒等,金字塔另配 4 色,五魔方 12 色。 */
  faceColor: Readonly<Record<string, PredictColor>>;
  /** 面字母 → 方位名(题面念「落在 X 面」用)。 */
  faceName: Readonly<Record<string, { zh: string; en: string }>>;
  /**
   * 立方体族(六个面 + U/D/L/R/F/B 记号成立)—— 决定能不能用「拿方朝向」那 24 档
   * 换色,以及方位字母提示用 `world.faceHints` 还是各自的角标。
   */
  cubeLike: boolean;
  /** 块分组:每组是若干 canonical 贴纸下标(同一块的几枚贴纸)。 */
  pieces: readonly (readonly number[])[];
  /** 这一块是什么类别。 */
  kindOf: (piece: readonly number[]) => PredictPieceKind;
  /**
   * 出题可追踪的块类别(顺序即 UI 里 chip 的顺序)。同时有角和棱时,UI 会自动
   * 多给一档「一对」= 各追一枚(斜转 / 枫叶没有棱,所以它们没有这一档)。
   */
  trackable: readonly PredictPieceKind[];
  /** 把一串转动作用在 perm 上,返回新的 perm(不改入参)。 */
  apply: (perm: readonly number[], moves: readonly string[]) => number[];
  /** 随机题面公式:相邻两步不同轴 / 不同面。 */
  randomMoves: (count: number, rnd: () => number) => string[];
  /** 把目标块甩到随机起点位的隐藏乱转(题面不展示)。 */
  placementMoves: (rnd: () => number) => string[];
  /**
   * 方位锚:位置固定、可以拿来认「现在看的是哪一面」的贴纸(奇数阶 NxN 的六个中心)。
   * 题板把它们压暗保留,其余非目标格一律灰掉。没有固定块的拼图给空数组 —— 那些拼图靠
   * 场景里的面 / 顶点字母认方位。
   */
  anchors: readonly number[];
  /** 题面公式默认几步。 */
  defaultMoveCount: number;
  /** 题面公式步数上限。 */
  moveCountMax: number;
  /** 自己输入的公式 → 题面那串(必须是本拼图 + `/sim` 引擎都认的记号)。 */
  parse: (text: string) => MoveInputResult;
  /** 收哪些记号 —— 输入框写错时原样说给用户听。 */
  notation: { zh: string; en: string };
  /** 一步里代表「面 / 轴」的那个字母,给题面卡片上色用;认不出返回 null。 */
  moveFace: (move: string) => string | null;
  /** 输入框的占位示例。 */
  placeholder: string;
  /**
   * 题面 token → 喂 `/sim` 引擎播动画的 token 串(可以是多步,空串 = 这一步不动)。
   * 省略 = 两边同一套记号 —— 除五魔方外都是这样,那是刻意的:记号不同就有「模型和
   * 眼睛看到的对不上」的风险,所以只在引擎面名实在读不出方位时(PG 的 `C A I BF E`)
   * 才翻一次。
   */
  engineMove?: (move: string) => string;
  /**
   * 方位字母:每个面(或转动轴)一个标签,题板把它们浮在拼图外侧,朝这边的看得见、
   * 背面的被拼图挡住。
   *
   * 立方体族不给这个 —— `cubeLike` 走引擎自带的 `world.faceHints`(U/D/L/R/F/B)。给的
   * 必须是**题面自己那套面名**:五魔方引擎的面名是 PG 的 `C A I BF E`,照搬引擎那份,
   * 屏幕上写着 `A`、题面念的却是 `DL`,等于没标。
   */
  hints?: readonly PredictFaceHint[];
}

/** 还原态 perm。 */
export const identityPerm = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/** canonical sid(`U0` / `F3`)→ 本拼图的贴纸下标;不在这个拼图上就返回 -1。 */
export function sidToIndex(faces: readonly string[], perFace: number, sid: string): number {
  const m = /^([A-Za-z]+)(\d+)$/.exec(sid);
  if (!m) return -1;
  const f = faces.indexOf(m[1]);
  const i = Number(m[2]);
  return f < 0 || i >= perFace ? -1 : f * perFace + i;
}

/** 贴纸下标 → 它的本位面序号。 */
export const faceOfIndex = (perFace: number, index: number): number => Math.floor(index / perFace);

/** 弯引号(网页 / 中文输入法粘出来的)→ ASCII:所有记号文法只认 `'`。 */
export const normalizeQuotes = (text: string): string => text.replace(/[’‘`´′]/g, "'");

/** 从 `PIECE_GROUPS` 那种 sid 分组表转成贴纸下标分组;不在本拼图上的 sid 直接丢。 */
export function groupsFromSids(
  faces: readonly string[], perFace: number, groups: readonly (readonly string[])[],
): number[][] {
  return groups
    .map((g) => g.map((sid) => sidToIndex(faces, perFace, sid)).filter((i) => i >= 0))
    .filter((g) => g.length > 0);
}
