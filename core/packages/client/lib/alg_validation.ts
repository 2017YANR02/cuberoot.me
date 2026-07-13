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
 * 对 LL 类 set (face/f2l) 还会检查公式末尾的 leaf 是否是 U-family(算多余 AUF)。
 */
import { Alg, Move } from 'cubing/alg';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import type { AlgSticker } from '@cuberoot/shared';

export interface ValidateAlgResult {
  ok: boolean;
  reason?: string;
}

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

  // NOTE: cubedb / SpeedCubeDB 的 alg 里有 `=y` / `=y2` / `=R'` / `=U2` 这种
  // "orientation hint" 标记,= 字符 cubing.js 不识别,直接 strip 即可(后跟的 token 仍执行)。
  const cleanAlg = alg.replace(/=/g, '');
  const cleanSetup = setup.replace(/=/g, '');

  let pattern: KPattern;
  let leafMoves: Move[];
  let kp: KPuzzle;
  try {
    kp = await loader;
    leafMoves = [...new Alg(cleanAlg).experimentalLeafMoves()];
    if (cleanSetup) new Alg(cleanSetup);
    const combined = (cleanSetup ? cleanSetup + ' ' : '') + cleanAlg;
    pattern = kp.defaultPattern().applyAlg(combined);
  } catch (e) {
    return { ok: false, reason: `公式语法错误: ${(e as Error).message}` };
  }

  const goal = (p: KPattern) => reachesGoal(p, kp, puzzle, sticker.kind);

  if (!goal(pattern)) {
    return {
      ok: false,
      reason: sticker.kind === 'f2l'
        ? 'F2L 没还原(setup + alg 后 D 层 / 中层 / 底层未完成)'
        : '执行 setup + alg 后没有还原魔方',
    };
  }

  // 收尾 AUF:库里存的是**完整公式**(setup + alg 精确还原),前端用 displayAlg() 显示时才剥掉。
  //
  // face 集合不用单独拦末尾 U:上面已经要求整体还原,而 U 转不是整体旋转 —— `setup + A` 和
  // `setup + A + U` 不可能同时还原。所以只要过了还原判据,末尾那个 U 必然是载荷性的收尾 AUF。
  //
  // f2l 集合就不同了:判据压根不看顶层,U 转对它毫无影响 ⟹ 末尾的 U 永远是多余的,拦掉。
  if (sticker.kind === 'f2l') {
    const trailing = trailingUFamilyMove(leafMoves);
    if (trailing) {
      return { ok: false, reason: `公式末尾的 ${trailing.toString()} 是多余的 AUF` };
    }
  }

  return { ok: true };
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
