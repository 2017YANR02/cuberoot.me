/**
 * 校验 alg case 的"setup + alg" 是否真的完成了**这个 set 该完成的事**。
 *
 * 支持的 puzzle:2x2 / 3x3 / 4x4 / 5x5 / sq1 / megaminx / pyraminx / skewb。
 *
 * ## 判据按 set 走,不是按 sticker.kind
 *
 * 「做完了」对每个 set 不是一个意思:PLL 要求整体还原,OLL 只要求翻色(顶层排列自由),
 * CMLL 连 M 层都不管。老代码一律拿「整体还原」去要求 face 类 ⟹ 全库约 1500 条好公式被判成
 * 「没还原」。目标态表在 `lib/alg_goals.ts`,那里也记着 cubing.js 的块编号(实测得来)。
 *
 * ## 收尾 AUF:**不要求人写**,库里替他补
 *
 * LL 公式做完常常差一个顶层转才「整体还原」。那个 U 对魔友没有意义(他自己会转),
 * 所以:**校验只要求「差一个 AUF 之内能还原」**,库里存补齐的完整式(`setup + alg` 精确还原),
 * 显示时 `displayAlg()` 再把它剥掉。补哪个 U 由 `auf` 字段告诉调用方 —— 站长定的规矩。
 *
 * f2l 类反过来:它的判据压根不看顶层,末尾的 U 永远是废动作,照旧拦。
 *
 * ## 记号
 *
 * 公式文本里混着换握记号 `↑↓·`、上游标注 `=`/`*`、连写(`U'D'`)—— 一律先过
 * `normalizeAlg`(和播放器同一份)。**别再把原文直接喂 cubing.js**:那样 611 条好公式
 * 会被报成语法错。含义见 `docs/alg-upstream-notation.md`。
 */
import { Alg, Move } from 'cubing/alg';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import type { AlgPuzzle, AlgSticker } from '@cuberoot/shared';
import { normalizeAlg } from '@/lib/alg_normalize';
import { displayAlg } from '@/lib/alg_display';
import { goalOf, reachesGoal, type AlgGoal } from '@/lib/alg_goals';

export interface ValidateAlgResult {
  ok: boolean;
  reason?: string;
  /** face 类:入库前要补在公式末尾的收尾 AUF(`''` = 不用补)。ok=false 时无意义。 */
  auf?: string;
}

/** 收尾 AUF 的四种可能。`''` 排最前 —— 已经写全的公式不该被改。 */
const AUF_CANDIDATES = ['', 'U', 'U2', "U'"] as const;

const PUZZLE_TO_CUBINGJS_ID: Record<string, string> = {
  '2x2': '2x2x2',
  '3x3': '3x3x3',
  '4x4': '4x4x4',
  '5x5': '5x5x5',
  'sq1': 'square1',
  'megaminx': 'megaminx',
  'pyraminx': 'pyraminx',
  'skewb': 'skewb',
};

const _kpuzzleCache: Record<string, Promise<KPuzzle>> = {};

function loadKpuzzle(puzzle: string): Promise<KPuzzle> | null {
  const id = PUZZLE_TO_CUBINGJS_ID[puzzle];
  if (!id) return null;
  if (!_kpuzzleCache[puzzle]) {
    _kpuzzleCache[puzzle] = import('cubing/puzzles').then(m => m.puzzles[id].kpuzzle());
  }
  return _kpuzzleCache[puzzle];
}

/**
 * 校验一个 case 的第 `ori` 个朝向时,该用哪个 setup。**两条约定,都是实测出来的:**
 *
 * 1. **setup 是空的** —— 2x2 全部、4x4/5x5 parity、skewb 都没写。它们的图是 VisualCube 拿
 *    `case`(= 公式取逆)画的 ⟹ 隐含 `setup = inverse(首条公式)`。照这个补,2x2 CLL 立刻 158/160。
 * 2. **多朝向** —— f2l 类一个 case 四个槽(FR / FL / BL / BR),setup 只描述第 0 个。
 *    第 k 个槽 = `y^-k · S · y^k`(**符号别搞反**:`y^k · S · y^-k` 只有 k=0/2 碰巧对)。
 */
export function setupForCase(
  puzzle: string,
  caseSetup: string,
  firstAlg: string | undefined,
  ori = 0,
): string {
  let base = caseSetup?.trim() ?? '';
  if (!base && firstAlg) {
    try { base = new Alg(normalizeAlg(puzzle as AlgPuzzle, firstAlg)).invert().toString(); }
    catch { return ''; }
  }
  if (!base || ori === 0) return base;
  const pre = ['', "y'", 'y2', 'y'][ori % 4];
  const post = ['', 'y', 'y2', "y'"][ori % 4];
  return `${pre} ${base} ${post}`.trim();
}

export async function validateAlgCase(
  setup: string,
  alg: string,
  sticker: AlgSticker,
  puzzle: string,
  set?: string,
): Promise<ValidateAlgResult> {
  const loader = loadKpuzzle(puzzle);
  if (!loader) return { ok: true };
  if (!alg.trim()) return { ok: true };

  const goalKind = goalOf(puzzle, set, sticker.kind);
  if (goalKind === 'skip') return { ok: true, auf: '' };

  let cleanAlg: string;
  let cleanSetup: string;
  let leafMoves: Move[];
  let kp: KPuzzle;
  try {
    kp = await loader;
    cleanAlg = normalizeAlg(puzzle as AlgPuzzle, alg);
    cleanSetup = setup ? normalizeAlg(puzzle as AlgPuzzle, setup) : '';
    leafMoves = [...new Alg(cleanAlg).experimentalLeafMoves()];
    if (cleanSetup) new Alg(cleanSetup);
  } catch (e) {
    return { ok: false, reason: `公式语法错误: ${(e as Error).message}` };
  }

  const goal = (p: KPattern) => reachesGoal(p, kp, puzzle, goalKind);
  const head = (cleanSetup ? cleanSetup + ' ' : '') + cleanAlg;
  const run = (tail: string): KPattern | null => {
    try { return kp.defaultPattern().applyAlg(tail ? `${head} ${tail}` : head); }
    catch { return null; }
  };

  // 判据不看顶层的那几类(F2L 系):末尾的 U 永远是废动作,拦掉 —— 补 AUF 也无从谈起。
  if (goalKind === 'f2l' || goalKind === 'f2l+co' || goalKind === 'f2l+eo') {
    const trailing = trailingUFamilyMove(leafMoves);
    if (trailing) return { ok: false, reason: `公式末尾的 ${trailing.toString()} 是多余的 AUF` };
    const p = run('');
    if (!p || !goal(p)) return { ok: false, reason: GOAL_MISS[goalKind] };
    return { ok: true, auf: '' };
  }

  // 其余:允许差一个收尾 AUF。至多一个成立 —— U 转不是整体旋转,`setup+A` 和 `setup+A+U`
  // 不可能同时达标,所以「补哪个 U」没有歧义。
  for (const auf of AUF_CANDIDATES) {
    const p = run(auf);
    if (p && goal(p)) return { ok: true, auf };
  }
  return { ok: false, reason: GOAL_MISS[goalKind] };
}

/** 没达标时给人看的话 —— 每个目标态一句,别再一律说「没有还原魔方」。 */
const GOAL_MISS: Record<AlgGoal, string> = {
  solve: '执行 setup + alg 后没有还原魔方(补任何收尾 AUF 都不行)',
  f2l: 'F2L 没做完(setup + alg 后 D 层 / 中层未完成)',
  'f2l+co': 'F2L 没做完,或顶层角没翻色',
  'f2l+eo': 'F2L 没做完,或顶层棱没翻色',
  oll: 'OLL 没做完(F2L 没保住,或顶层没翻齐色)',
  'll-corners': '顶层角没做好(位置 + 朝向),或 F2L / 顶棱翻色没保住',
  'roux-blocks': '桥式左右两块没做完(D 层角 + 非 M 层棱)',
  'roux-blocks+eo': '桥式两块没做完,或 M 层四棱(UF/UB/DF/DB)没翻色',
  cmll: 'CMLL 没做完(Roux 两块没保住,或顶层角没做好)',
  co: '八个角没全部翻色',
  'oll-4x4': '4x4 OLL 没做完(顶面没同色,或顶面以下没还原)',
  centers: '中心块没还原',
  skip: '',
};

/**
 * 入库前把公式补成**完整式**:剥掉原有的收尾 AUF,再按校验器算出来的补回去。
 * 幂等 —— 已经补齐的公式过一遍还是它自己。校验不过就原样退回(由调用方拦下)。
 */
export async function completeAlgAuf(
  setup: string,
  alg: string,
  sticker: AlgSticker,
  puzzle: string,
  set?: string,
): Promise<string> {
  const bare = displayAlg(alg);
  const r = await validateAlgCase(setup, bare, sticker, puzzle, set);
  if (!r.ok) return alg;
  return r.auf ? `${bare} ${r.auf}` : bare;
}

/** 公式最后一个 leaf 是不是 U-family(U / U2 / U') */
function trailingUFamilyMove(moves: Move[]): Move | null {
  if (moves.length === 0) return null;
  const last = moves[moves.length - 1];
  return last.family === 'U' ? last : null;
}
