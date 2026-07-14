/**
 * 校验 alg case 的"setup + alg" 是否真的完成了对应阶段。
 *
 * 支持的 puzzle:2x2 / 3x3 / 4x4 / 5x5 / sq1 / megaminx / pyraminx / skewb。
 *
 * 校验规则按 sticker.kind:
 *  - 'face' (LL 类:PLL/OLL/COLL/EO/ZBLL/CMLL/2x2 CLL/...): setup + alg 后整体还原。
 *      cube 系列(2x2~5x5)允许整体 rotation 末尾(24 个);其它 puzzle 严格 equal default。
 *  - 'f2l' (3x3 F2L/SBLS/adv-F2L/ZBLS): D 层 + 中层棱 + D 层棱 全 piece+ori 归位 (LL 任意)。
 *      仅 3x3 启用,其它 puzzle 不出现 F2L kind。
 *  - 'raw': 跳过(自定义 sticker,语义不明)。
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

const CUBE_LIKE = new Set(['2x2', '3x3', '4x4', '5x5']);

/** 24 整体 rotation,允许 cube 类公式末尾带 y/x/z 一类整体调整 */
const CUBE_ORIENTATIONS: string[] = (() => {
  const out: string[] = [];
  const tops = ['', 'x', 'x2', "x'", 'z', "z'"];
  const ys = ['', 'y', 'y2', "y'"];
  for (const t of tops) for (const y of ys) {
    out.push([t, y].filter(Boolean).join(' '));
  }
  return out;
})();

const _kpuzzleCache: Record<string, Promise<KPuzzle>> = {};

function loadKpuzzle(puzzle: string): Promise<KPuzzle> | null {
  const id = PUZZLE_TO_CUBINGJS_ID[puzzle];
  if (!id) return null;
  if (!_kpuzzleCache[puzzle]) {
    _kpuzzleCache[puzzle] = import('cubing/puzzles').then(m => m.puzzles[id].kpuzzle());
  }
  return _kpuzzleCache[puzzle];
}

export async function validateAlgCase(
  setup: string,
  alg: string,
  sticker: AlgSticker,
  puzzle: string,
): Promise<ValidateAlgResult> {
  const loader = loadKpuzzle(puzzle);
  if (!loader) return { ok: true };
  if (!alg.trim()) return { ok: true };

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

  const goal = (p: KPattern) => reachesGoal(p, kp, puzzle, sticker.kind);
  const head = (cleanSetup ? cleanSetup + ' ' : '') + cleanAlg;
  const run = (tail: string): KPattern | null => {
    try { return kp.defaultPattern().applyAlg(tail ? `${head} ${tail}` : head); }
    catch { return null; }
  };

  // f2l:判据不看顶层 ⟹ 末尾的 U 永远是废动作,拦掉(补 AUF 也无从谈起)。
  if (sticker.kind === 'f2l') {
    const trailing = trailingUFamilyMove(leafMoves);
    if (trailing) return { ok: false, reason: `公式末尾的 ${trailing.toString()} 是多余的 AUF` };
    const p = run('');
    if (!p || !goal(p)) return { ok: false, reason: 'F2L 没还原(setup + alg 后 D 层 / 中层 / 底层未完成)' };
    return { ok: true, auf: '' };
  }

  // face:允许差一个收尾 AUF。四种里至多一种成立 —— U 转不是整体旋转,`setup+A` 和
  // `setup+A+U` 不可能同时还原,所以「补哪个 U」没有歧义。
  for (const auf of AUF_CANDIDATES) {
    const p = run(auf);
    if (p && goal(p)) return { ok: true, auf };
  }
  return { ok: false, reason: '执行 setup + alg 后没有还原魔方(补任何收尾 AUF 都不行)' };
}

/**
 * 入库前把公式补成**完整式**:剥掉原有的收尾 AUF,再按校验器算出来的补回去。
 * 幂等 —— 已经补齐的公式过一遍还是它自己。校验不过就原样退回(由调用方拦下)。
 */
export async function completeAlgAuf(
  setup: string,
  alg: string,
  sticker: AlgSticker,
  puzzle: string,
): Promise<string> {
  const bare = displayAlg(alg);
  const r = await validateAlgCase(setup, bare, sticker, puzzle);
  if (!r.ok) return alg;
  return r.auf ? `${bare} ${r.auf}` : bare;
}

/** 本集合的目标态达成了吗?face = 整体还原;f2l = D 层 + 中层完整。 */
function reachesGoal(pattern: KPattern, kp: KPuzzle, puzzle: string, kind: AlgSticker['kind']): boolean {
  if (kind === 'face') return isFullySolved(pattern, kp, puzzle);
  if (kind === 'f2l') return puzzle !== '3x3' || isF2LSolvedUpToRotation(pattern);
  return true;
}

/** 整体还原?cube 类容忍 24 个整体 rotation(公式里可能带 y / x 等) */
function isFullySolved(pattern: KPattern, kp: KPuzzle, puzzle: string): boolean {
  const def = kp.defaultPattern();
  if (patternsEqual(pattern, def)) return true;
  if (!CUBE_LIKE.has(puzzle)) return false;
  for (const r of CUBE_ORIENTATIONS) {
    try {
      if (r && patternsEqual(pattern.applyAlg(r), def)) return true;
    } catch { /* skip */ }
  }
  return false;
}

function isF2LSolvedUpToRotation(pattern: KPattern): boolean {
  // 容忍整体 rotation:公式可能含 y/y2/x 等,patternData 里 piece id 跟着旋转,
  // 严格 piece===slot 检查会假阴性。试 24 个 rotation,任一让 F2L 严格完整即过。
  for (const r of CUBE_ORIENTATIONS) {
    try {
      const t = r ? pattern.applyAlg(r) : pattern;
      if (isF2LStrict(t)) return true;
    } catch { /* skip */ }
  }
  return false;
}

function isF2LStrict(pattern: KPattern): boolean {
  const cp = pattern.patternData.CORNERS;
  const ep = pattern.patternData.EDGES;
  for (let i = 4; i < 8; i++) {
    if (cp.pieces[i] !== i) return false;
    if ((cp.orientation[i] ?? 0) !== 0) return false;
  }
  for (let i = 4; i < 12; i++) {
    if (ep.pieces[i] !== i) return false;
    if ((ep.orientation[i] ?? 0) !== 0) return false;
  }
  return true;
}

/** 公式最后一个 leaf 是不是 U-family(U / U2 / U') */
function trailingUFamilyMove(moves: Move[]): Move | null {
  if (moves.length === 0) return null;
  const last = moves[moves.length - 1];
  return last.family === 'U' ? last : null;
}

function patternsEqual(a: KPattern, b: KPattern): boolean {
  return JSON.stringify(a.patternData) === JSON.stringify(b.patternData);
}
