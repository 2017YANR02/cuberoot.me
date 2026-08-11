/**
 * 校验 case 的 **setup 本身**是不是一个合法的 case 状态 —— 与 `alg_goals.ts` 对偶:
 * 那边管「做完之后该是什么样」,这里管「做之前该是什么样」。
 *
 * ## 为什么需要单独一条
 *
 * `validateAlgCase` 只问「setup + alg 能不能到目标态」。一条 setup 可以把**别的槽**也搅了,
 * 只要 alg 顺手修回来,那个校验照样通过 —— 但它画出来的图是错的。实例(站内 zbls):
 *
 *     A+/D   setup = "M' U M U2 R' F R"
 *     ⇒ DFL 角(扭 2)与 FL 棱双双错位。ZBLS 的前提是「其余三槽已解」,这张图的左槽是乱的。
 *
 * 这类问题 `validateAlgCase` 抓不到,得靠本模块。
 *
 * ## 块编号(cubing.js 实测,与 alg_goals.ts 同一套)
 *
 *   3x3 CORNERS  0=UFR 1=UBR 2=UBL 3=UFL | 4=DFR 5=DFL 6=DBL 7=DBR
 *   3x3 EDGES    0=UF 1=UR 2=UB 3=UL | 4=DF 5=DR 6=DB 7=DL | 8=FR 9=FL 10=BR 11=BL
 */
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { CUBE_ORIENTATIONS } from '@/lib/alg_goals';
import { normalizeAlg } from '@/lib/alg_normalize';
import type { AlgPuzzle } from '@cuberoot/shared';

export type AlgPrecondition =
  | 'f2l-one-slot'  // 底两层只剩一个槽没做(F2L 类:f2l / zbls / wv / vls / cls / sv …)
  | 'll'            // 底两层全解,只剩顶层(OLL / PLL / COLL / ZBLL / 1LLL …)
  | 'none';         // 不检查(桥式类、非 3x3、语义还没定的)

export interface PreconditionResult {
  ok: boolean;
  reason?: string;
}

/**
 * set → 前提。只登记语义明确的;没登记的一律 `none`(不误伤)。
 * key 与 `SET_GOAL` 同格式:`${puzzle}/${set}`。
 */
export const SET_PRECONDITION: Record<string, AlgPrecondition> = {
  '3x3/f2l': 'f2l-one-slot',
  '3x3/zbls': 'f2l-one-slot',
  '3x3/wv': 'f2l-one-slot',
  '3x3/sv': 'f2l-one-slot',
  '3x3/vls': 'f2l-one-slot',
  '3x3/cls': 'f2l-one-slot',
  // adv-f2l(Trapped Corner / Trapped Edge)与 psf2l 的 case 本来就可能同时占用两个槽,
  // 两个槽不完整是定义,不是错误;fruf 的 case 允许 DF 棱在外。都不套单槽前提。
  '3x3/adv-f2l': 'none',
  '3x3/psf2l': 'none',
  '3x3/fruf': 'none',
  '3x3/oll': 'll',
  '3x3/2-look-oll': 'll',
  '3x3/2-look-pll': 'll',
  '3x3/pll': 'll',
  '3x3/coll': 'll',
  '3x3/ollcp': 'll',
  '3x3/zbll': 'll',
  '3x3/1lll': 'll',
  '3x3/ell': 'll',
  '3x3/anti-pll': 'll',
};

export function preconditionOf(puzzle: string, set: string | undefined): AlgPrecondition {
  if (!set) return 'none';
  return SET_PRECONDITION[`${puzzle}/${set}`] ?? 'none';
}

// F2L 的 4 组「角 + 棱」。顺序:FR / FL / BL / BR。
const PAIRS: { name: string; corner: number; edge: number }[] = [
  { name: 'FR', corner: 4, edge: 8 },
  { name: 'FL', corner: 5, edge: 9 },
  { name: 'BL', corner: 6, edge: 11 },
  { name: 'BR', corner: 7, edge: 10 },
];
const D_EDGES = [4, 5, 6, 7];      // DF DR DB DL
const D_CORNERS = [4, 5, 6, 7];
const F2L_EDGES = [4, 5, 6, 7, 8, 9, 10, 11];

interface Orbit { pieces: number[]; orientation: number[] }
const orbit = (p: KPattern, name: string) => p.patternData[name] as unknown as Orbit;
const solvedAt = (o: Orbit, i: number) => o.pieces[i] === i && (o.orientation[i] ?? 0) === 0;

/**
 * 检查 setup 之后的状态是否满足该 set 的前提。
 * 只对 3x3 生效 —— 其余 puzzle 的槽语义没统一,一律放行。
 */
export function checkPrecondition(
  pattern: KPattern,
  pre: AlgPrecondition,
  puzzle: string,
): PreconditionResult {
  if (pre === 'none' || puzzle !== '3x3') return { ok: true };
  const c = orbit(pattern, 'CORNERS'), e = orbit(pattern, 'EDGES');

  if (pre === 'll') {
    const badC = D_CORNERS.filter((i) => !solvedAt(c, i));
    const badE = F2L_EDGES.filter((i) => !solvedAt(e, i));
    if (badC.length || badE.length) {
      return { ok: false, reason: `底两层没解干净(顶层类 set 的前提):${describe(badC, badE)}` };
    }
    return { ok: true };
  }

  // f2l-one-slot:D 层 4 棱必须全解;4 组 pair 里至少 3 组完整;缺的角与棱必须属于同一组。
  const badD = D_EDGES.filter((i) => !solvedAt(e, i));
  if (badD.length) {
    return { ok: false, reason: `底面棱没解干净:${describe([], badD)}` };
  }
  const broken = PAIRS.filter((p) => !solvedAt(c, p.corner) || !solvedAt(e, p.edge));
  if (broken.length === 0) return { ok: true };  // 全解也算合法(「已还原」那一格)
  if (broken.length > 1) {
    return {
      ok: false,
      reason: `底两层有 ${broken.length} 个槽没做(该 set 只允许 1 个):${broken.map((p) => p.name).join(' / ')}`,
    };
  }
  // 恰好一个槽不完整 —— 但别的槽的块不许跑到它里面去(那说明是两个槽互相串了)
  const slot = broken[0];
  const strayC = D_CORNERS.filter((i) => i !== slot.corner && !solvedAt(c, i));
  const strayE = [8, 9, 10, 11].filter((i) => i !== slot.edge && !solvedAt(e, i));
  if (strayC.length || strayE.length) {
    return { ok: false, reason: `除 ${slot.name} 槽外还有块错位:${describe(strayC, strayE)}` };
  }
  return { ok: true };
}

/**
 * 从 setup 文本直接判前提。**带 24 朝向容忍** —— 库里的 setup 常带整体转体(vls 56 条、
 * cls 49 条;zbls 那 112 条已在 2026-07-24 归一到 FR 时抽掉),不容忍的话底两层会被当成
 * 侧面,全体误判。与 `reachesGoal` 同一套做法。
 */
export async function checkSetupPrecondition(
  setup: string,
  puzzle: string,
  set: string | undefined,
  kpuzzle: KPuzzle,
): Promise<PreconditionResult> {
  const pre = preconditionOf(puzzle, set);
  if (pre === 'none' || puzzle !== '3x3') return { ok: true };
  let base: KPattern;
  try {
    base = kpuzzle.defaultPattern().applyAlg(normalizeAlg(puzzle as AlgPuzzle, setup));
  } catch (err) {
    return { ok: false, reason: `setup 解析失败:${(err as Error).message}` };
  }
  let firstReason: string | undefined;
  for (const rot of CUBE_ORIENTATIONS) {
    const r = checkPrecondition(rot ? base.applyAlg(rot) : base, pre, puzzle);
    if (r.ok) return { ok: true };
    firstReason ??= r.reason;
  }
  return { ok: false, reason: firstReason };
}

const CORNER_NAMES = ['UFR', 'UBR', 'UBL', 'UFL', 'DFR', 'DFL', 'DBL', 'DBR'];
const EDGE_NAMES = ['UF', 'UR', 'UB', 'UL', 'DF', 'DR', 'DB', 'DL', 'FR', 'FL', 'BR', 'BL'];

function describe(corners: number[], edges: number[]): string {
  return [...corners.map((i) => CORNER_NAMES[i]), ...edges.map((i) => EDGE_NAMES[i])].join(', ');
}
