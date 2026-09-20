/**
 * 公式给魔友看的形式。
 *
 * 库里存的是**完整公式**:`setup + alg` 精确还原,所以末尾常带一个把顶层转正的收尾 AUF。
 * 那个 U 对魔友没有任何帮助(他自己会转),所以显示和复制时剥掉。
 * 公式末尾用来恢复持方的 y 转体也同理：原式和播放保留，仅展示时隐藏。
 *
 * 剥掉是安全的:若 `setup + A U^b` 还原,那 A 单独执行后魔方只差一个顶层转 —— 末尾的
 * U^b 必然是纯收尾 AUF,不可能是公式的一部分(它后面没有任何步骤能被它影响)。
 *
 * ⚠ **播放器 / 缩略图 / recon 查表要的是完整公式,别喂它们 displayAlg 的结果** ——
 * 剥了 AUF 的公式跑完停在没还原的魔方上。只有「渲染文本」和「复制到剪贴板」用这个。
 *
 * 纯字符串操作,不过 cubing.js —— 括号、`=` 标记、`·↑↓` 指法记号都要原样保留。
 */

import { is3x3TopLayerSet } from '@cuberoot/shared/alg';
import { mergeAdjacentMoves, renderMove, toMoveString, tokenizeMoves } from '@cuberoot/shared/alg-notation';
import { algHtmlText, editAlgHtmlText, type AlgTextEdit } from '@/lib/alg_html';

/** Only U-layer turns: cube order four, Megaminx order five, Pyraminx/FTO order three. */
export function uTurnOrder(puzzle: string): number | undefined {
  if (['2x2', '3x3', '4x4', '5x5'].includes(puzzle)) return 4;
  if (puzzle === 'megaminx') return 5;
  if (puzzle === 'pyraminx' || puzzle === 'fto') return 3;
  return undefined;
}

/** Preserve notation and grouping; reduce adjacent plain U turns without flattening the source. */
export function adjacentUEdits(alg: string, order: number): AlgTextEdit[] {
  const tokens = [...alg.matchAll(/(^|[\s(])(U(?:2'?|')?)(?=$|[\s)])/g)].map(m => ({
    start: m.index! + m[1].length, end: m.index! + m[0].length,
    amount: (m[2].includes('2') ? 2 : 1) * (m[2].endsWith("'") ? -1 : 1),
  }));
  const edits: AlgTextEdit[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const first = tokens[i];
    let last = first;
    let amount = first.amount;
    let count = 1;
    while (i + 1 < tokens.length && /^\s*$/.test(alg.slice(last.end, tokens[i + 1].start))) {
      last = tokens[++i]; amount += last.amount; count++;
    }
    if (count > 1) {
      const turn = ((amount % order) + order) % order;
      const signed = turn > order / 2 ? turn - order : turn;
      const text = signed === 0 ? '' : `U${Math.abs(signed) === 1 ? '' : Math.abs(signed)}${signed < 0 ? "'" : ''}`;
      edits.push({ start: first.start, end: last.end, text });
    }
  }
  return edits;
}

export function applyAlgTextEdits(alg: string, edits: readonly AlgTextEdit[]): string {
  let out = alg;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out.trim();
}

export function simplifyAdjacentU(puzzle: string, alg: string): string {
  const order = uTurnOrder(puzzle);
  return order ? applyAlgTextEdits(alg, adjacentUEdits(alg, order)) : alg;
}

/**
 * 顶层打乱的收尾 y 改为同向 U，保留顶面及侧面顶排的逐贴纸位置。
 * 下两层保持原拿法；这不是完整魔方的等价变换，不能用于解法或播放器 setup。
 * 只处理末尾连续的 U/y（包括观察角度追加的 U），不碰内部转体或 F2L 换槽。
 */
export function displayCaseScramble(puzzle: string, set: string, scramble: string): string {
  scramble = simplifyAdjacentU(puzzle, scramble);
  if (!scramble || !is3x3TopLayerSet(puzzle, set)) return scramble;
  try {
    const { moves, junk } = tokenizeMoves(toMoveString(scramble));
    if (junk.length) return scramble;
    let start = moves.length;
    while (start > 0 && !moves[start - 1].layer
      && (moves[start - 1].family === 'U' || moves[start - 1].family === 'y')) start--;
    if (!moves.slice(start).some(move => move.family === 'y')) return scramble;
    return mergeAdjacentMoves(moves.map((move, index) => renderMove(
      index >= start && move.family === 'y' ? { ...move, family: 'U' } : move,
    )).join(' '));
  } catch {
    return scramble;
  }
}

/** 末尾的 U 层 AUF 或 y 转体(可带括号)；`Uw`、`u` 不算。 */
const TRAILING_DISPLAY_ADJUSTMENT = /[\s(]*\b[Uy](?:2'?|'|)(?![\w'])\s*\)?\s*$/;

export function displayAlg(alg: string): string {
  if (!alg) return '';
  let stripped = alg;
  while (true) {
    const next = stripped.replace(TRAILING_DISPLAY_ADJUSTMENT, '').trimEnd();
    // 整条公式只剩显示调整(理论上不该有)—— 至少留下一步,别剥成空串。
    if (!next || next === stripped) return stripped;
    stripped = next;
  }
}

/** Presentation always drops finishing y; top-layer sets also drop finishing AUF. */
function caseAlgDisplayEdits(puzzle: string, set: string, alg: string): AlgTextEdit[] {
  const hideAuf = is3x3TopLayerSet(puzzle, set);
  const tokens = [...alg.matchAll(/[()]|[^\s()]+/g)];
  let end = tokens.length - 1;
  let adjustments = 0;
  while (end >= 0) {
    const token = tokens[end][0];
    if (token === '(' || token === ')') { end--; continue; }
    if (!/^y(?:2'?|')?$/.test(token) && !(hideAuf && /^U(?:2'?|')?$/.test(token))) break;
    adjustments++;
    end--;
  }
  if (!adjustments || end < 0) return [];
  // Retain groups around surviving moves; discard groups containing only AUF/y.
  // A repetition, commutator, wide turn or x/z at the end stops the scan.
  const start = tokens[end].index! + tokens[end][0].length;
  let depth = 0;
  let closing = '';
  for (const token of tokens.slice(end + 1)) {
    if (token[0] === '(') depth++;
    if (token[0] === ')') {
      if (depth > 0) depth--;
      else closing += ')';
    }
  }
  return [{ start, end: alg.length, text: closing }];
}

/**
 * 已入库旧数据的只读兜底：移除没有左括号的 `)`，并在末尾补齐缺少的 `)`。
 * 新写入会被严格校验拒绝；这里不展开分组，也不改变任何 move。
 */
function legacyGroupingBalanceEdits(alg: string): AlgTextEdit[] {
  const edits: AlgTextEdit[] = [];
  let depth = 0;
  for (let i = 0; i < alg.length; i++) {
    if (alg[i] === '(') depth++;
    else if (alg[i] === ')') {
      if (depth > 0) depth--;
      else edits.push({ start: i, end: i + 1, text: '' });
    }
  }
  if (depth > 0) edits.push({ start: alg.length, end: alg.length, text: ')'.repeat(depth) });
  return edits;
}

export function displayCaseAlg(puzzle: string, set: string, alg: string): string {
  const edits = caseAlgDisplayEdits(puzzle, set, alg);
  const shown = edits.length ? applyAlgTextEdits(alg, edits) : alg;
  return applyAlgTextEdits(shown, legacyGroupingBalanceEdits(shown));
}

/** Apply the same move edits to rich text without losing finger annotations. */
export function displayCaseAlgHtml(puzzle: string, set: string, html: string): string {
  const shown = editAlgHtmlText(html, caseAlgDisplayEdits(puzzle, set, algHtmlText(html)));
  return editAlgHtmlText(shown, legacyGroupingBalanceEdits(algHtmlText(shown)));
}

/**
 * 顶层 case 的观察角度。URL 不直接存 `U'`，避免引号在分享链接里显得含混。
 * `default` 是库里的原始角度，其余三项表示在摆好 case 后再做的 U 层调整。
 */
export const CASE_VIEW_ANGLES = ['default', 'u', 'u2', 'up'] as const;
export type CaseViewAngle = (typeof CASE_VIEW_ANGLES)[number];

const CASE_VIEW_SETUP_AUF: Record<CaseViewAngle, string> = {
  default: '',
  u: 'U',
  u2: 'U2',
  up: "U'",
};

const CASE_VIEW_SOLUTION_AUF: Record<CaseViewAngle, string> = {
  default: '',
  u: "U'",
  u2: 'U2',
  up: 'U',
};


/** 摆好 case 后补用户选择的 U 层角度。 */
export function caseViewSetup(setup: string, angle: CaseViewAngle): string {
  const auf = CASE_VIEW_SETUP_AUF[angle];
  if (!setup || !auf) return setup;
  return simplifyAdjacentU('3x3', `${setup.trimEnd()} ${auf}`);
}

/**
 * 同一状态转了 U^k 后，解法必须在开头补 U^-k；若原公式也以 U 开头，顺手合并相邻 AUF。
 * 合并连续的普通 U 层动作，不碰 Uw / u，保留分组和指法记号。
 */
export function caseViewAlg(alg: string, angle: CaseViewAngle): string {
  const prefix = CASE_VIEW_SOLUTION_AUF[angle];
  if (!alg || !prefix) return alg;

  return simplifyAdjacentU('3x3', `${prefix} ${alg.trimStart()}`);
}

/**
 * 多朝向 case(f2l 类的 FR / FL / BL / BR 四个槽)第 `oriIdx` 个朝向的**显示用** setup。
 *
 * 显示路径与校验路径差一个整体转体,别混用:
 *   显示(这里)  `setup y^k`      —— 图与播放器要的是「同一个 case 摆在第 k 个槽」
 *   校验         `y^-k setup y^k` —— 见 alg_validation.ts 的 `setupForCase`(f2l 判据自带 24 朝向容忍)
 *
 * 曾经是 AlgCategoryView 的私有函数,case 详情页因此没用上:详情页把四个朝向的公式全渲染
 * 出来却一律传未调整的 setup,导致 FL/BL/BR 三组的缩略图与动画演的都是**别的** case
 * (拿它校 f2l 全部 622 条只过 164 条 = 只有 FR 那组)。提到这里给两边共用。
 */
const ORI_SUFFIX = ['', 'y', 'y2', "y'"];

export function oriAdjustSetup(setup: string, oriIdx: number): string {
  if (!setup || oriIdx === 0) return setup;
  return `${setup} ${ORI_SUFFIX[oriIdx % 4]}`;
}

/**
 * 槽名的缩写:`Front Right` → `FR`。库里 `ori_names` 存的是全称,而站上到处都拿槽名
 * 当标签(视角切换器、case 卡上的当前朝向、详情页每组公式的小标题),全称一律太长。
 * 认不出来的名字原样返回 —— 别的 set 可能存了别的朝向名。
 */
const ORI_SHORT: Record<string, string> = {
  'Front Right': 'FR', 'Front Left': 'FL', 'Back Left': 'BL', 'Back Right': 'BR',
};

export function shortOriName(name: string): string {
  return ORI_SHORT[name] ?? name;
}
