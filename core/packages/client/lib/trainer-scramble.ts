// Ported from packages/client-vite/src/utils/trainerScramble.ts
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import { flattenAlg } from '@cuberoot/shared/alg-notation';
import { equivalentPyraScramble } from './pyraminx-solver';
import { allowedPostAuf, oriCornersOnly, type OrientationSel } from './alg_ll_orientation';
import { tr } from '@/i18n/tr';

const AUF = ['', 'U', 'U2', "U'"];
const Y = ['', 'y', 'y2', "y'"];
/** 金字塔的顶层是 3 阶轴,只有 U / U' 两种「不是不转」的对齐(没有 U2)。 */
const PYRA_AUF = ['', 'U', "U'"];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const U_TURN_RE = /^(U2|U'|U)$/;
function quarterOf(tok: string): number {
  if (tok === 'U') return 1;
  if (tok === 'U2') return 2;
  if (tok === "U'") return 3;
  return 0;
}
function turnOf(q: number): string {
  const m = ((q % 4) + 4) % 4;
  return m === 0 ? '' : m === 1 ? 'U' : m === 2 ? 'U2' : "U'";
}

/**
 * 把随机 AUF 接到公式首尾时,若紧邻的那一端本来就是 U 层转动(常见 —— 打乱本身
 * 收尾常是 U 系),直接拼接会出现「U' U」这种物理上互相抵消的来回转动。这里按
 * 层转角度取模合并成一次转动(抵消为 0 就整段丢弃),而不是原样拼接两个 token。
 */
function joinWithAufMerge(pre: string, baseTokens: readonly string[], post: string): string {
  const tokens = [...baseTokens];
  const prefix: string[] = [];
  if (pre) {
    if (tokens.length > 0 && U_TURN_RE.test(tokens[0])) {
      const merged = turnOf(quarterOf(pre) + quarterOf(tokens[0]));
      tokens.shift();
      if (merged) prefix.push(merged);
    } else {
      prefix.push(pre);
    }
  }
  const suffix: string[] = [];
  if (post) {
    if (tokens.length > 0 && U_TURN_RE.test(tokens[tokens.length - 1])) {
      const merged = turnOf(quarterOf(tokens[tokens.length - 1]) + quarterOf(post));
      tokens.pop();
      if (merged) suffix.push(merged);
    } else {
      suffix.push(post);
    }
  }
  return [...prefix, ...tokens, ...suffix].join(' ').trim();
}

function inverseAlg(alg: string): string {
  return alg
    .split(/\s+/)
    .filter(Boolean)
    .map(m => {
      if (m.endsWith('2')) return m;
      if (m.endsWith("'")) return m.slice(0, -1);
      return m + "'";
    })
    .reverse()
    .join(' ');
}

/**
 * 出题用哪一种打乱。除 `inv` 外全部来自站长那张 1LLL 表(`alg_cases.meta`),
 * 只有 1lll / zbll / pll / ell 有。
 *
 * ⚠ 表里这些打乱列**不是每条都对**:`Scramble` 是首条公式的逆,首条坏了它跟着坏;
 * `SH*` / `SQ*` / `H*` / `Q*` / `COEP` 各有各的独立错误(实测 113 条打的是别的 case)。
 * 导入时已逐条过 16 折轨道判据,验不过的**不入库**(见 alg-build/import_1lll.mjs)——
 * 所以这里看到的都是真的。缺了就退回 `inv`,绝不猜。
 */
export type ScrambleKind = 'inv' | 'cstimer' | 'rand' | 'stm' | 'sqtm' | 'htm' | 'qtm' | 'coep';

/**
 * 选择器里的顺序与名字。`SH*` / `SQ*` / `H*` / `Q*` 是站长表里的列名(星号 = 最优),
 * 度量的学名在括号里 —— 表叫 SH/SQ,其实是 STM / SQTM(不是 HTM/QTM,那两个另有其列)。
 * `cstimer` = 随机态求解器风格(同 cstimer 训练打乱:现算 ≈20 步全脸序列),仅 3x3。
 */
export const SCRAMBLE_KINDS: ReadonlyArray<{ id: ScrambleKind; label: () => string }> = [
  { id: 'htm', label: () => `H* (HTM)` },
  // 金字塔专有(见 generateScramble):同一个 case,随机长路径 + 随机顶层朝向。
  // 排在 `inv` 之前 —— 它是金字塔的默认(TrainerRunClient 的 kinds 兜底取它)。
  { id: 'rand', label: () => tr({ zh: '随机长打乱', en: 'Randomized' }) },
  { id: 'inv', label: () => tr({ zh: '逆 case', en: 'Inv case' }) },
  { id: 'stm', label: () => `SH* (STM)` },
  { id: 'sqtm', label: () => `SQ* (SQTM)` },
  { id: 'qtm', label: () => `Q* (QTM)` },
  { id: 'coep', label: () => 'COEP' },
  { id: 'cstimer', label: () => 'cstimer' },
];

/** 这个 case 支持哪些打乱类型(`inv` 永远支持 —— 它就是 setup 的逆) */
export function availableKinds(c: AlgCase): ScrambleKind[] {
  const out: ScrambleKind[] = ['inv'];
  for (const k of ['stm', 'sqtm', 'htm', 'qtm'] as const) {
    if (c.meta?.optimal?.[k]?.scramble) out.push(k);
  }
  if (c.meta?.coep?.scramble) out.push('coep');
  return out;
}

/**
 * 这个 case 的默认打乱(= `setup`,没有就取首条公式的逆)。朝向分组要拿它当代表 ——
 * 与库里那张 case 图同一条串,算出来的朝向和图上看到的一致。
 */
export function caseBaseAlg(c: AlgCase): string {
  return baseForKind(c, 'inv') ?? '';
}

/** 选定类型下的打乱本体(没有就 null —— 调用方退回 `inv`) */
function baseForKind(c: AlgCase, kind: ScrambleKind): string | null {
  if (kind === 'coep') return c.meta?.coep?.scramble ?? null;
  if (kind === 'stm' || kind === 'sqtm' || kind === 'htm' || kind === 'qtm') {
    return c.meta?.optimal?.[kind]?.scramble ?? null;
  }
  // `inv`(以及 `cstimer` 求解完成前的同步占位)都用 setup / 首条公式的逆
  const baseAlg = c.algs.flat()[0]?.alg ?? c.standard ?? '';
  return (c.setup && c.setup.trim() ? c.setup.trim() : inverseAlg(baseAlg)) || null;
}

/**
 * cstimer 风格打乱:把「逆 case 打乱」(pre/post-AUF 已并入)当作状态 setup,
 * 交给两阶段求解器解出该状态再取逆 —— 得到一条 ≈20 步、全脸随机态风格的打乱,
 * 与 cstimer 训练打乱同一造法(cstimer 用 min2phase 现算,不是硬编码公式表)。
 * 求解器 chunk(cubing/search)按需懒加载;失败返回 null,调用方保留占位打乱。
 */
export async function cstimerStyleScramble(invScramble: string): Promise<string | null> {
  try {
    const { equivalentCleanScramble } = await import('./scramble-from-solution');
    const s = await equivalentCleanScramble(invScramble);
    return s || null;
  } catch {
    return null;
  }
}

/**
 * 收尾 AUF 的候选。默认四选一;用户在训练设置里挑了朝向(「黄条只朝上」之类),就只留
 * 摆得出那个朝向的那些 —— 相对的是 `pre + base` 的实际状态,起手 AUF 挪的相位一并算进去。
 *
 * 朝向偏好压过 post-AUF 开关:关掉 post-AUF 是「别随机换朝向」,钉一个朝向同样是这个诉求
 * 的一种(而且更强)。两个都设了还让开关赢的话,点了图没反应 —— 那才是坏的。
 * 都没设就照旧:关 = 打乱原样呈现,朝向恒等于库里那张图;开 = 四选一。
 */
function postAufPool(
  c: AlgCase, pre: string, base: string, size: number, opts?: TrainerScrambleOpts,
): readonly string[] {
  const corners = oriCornersOnly(size === 2 ? '2x2' : '3x3', c.srcSet ?? opts?.orientationSet);
  const pinned = allowedPostAuf(
    [pre, base].filter(Boolean).join(' '), size, opts?.orientation, corners,
  );
  if (pinned) return pinned;
  return opts?.postAuf === false ? [''] : AUF;
}

export interface TrainerScrambleOpts {
  preAuf?: boolean;
  postAuf?: boolean;
  /** 顶层朝向偏好(朝向组键 → 允许的相位),见 `lib/alg_ll_orientation`。 */
  orientation?: OrientationSel;
  /** 本场的 set slug —— 判据按 set 走(CMLL 只看角块)。合练时以 case 自带的 `srcSet` 为准。 */
  orientationSet?: string | null;
}

export function generateScramble(
  c: AlgCase,
  puzzle: AlgPuzzle,
  kind: ScrambleKind = 'inv',
  opts?: TrainerScrambleOpts,
): string {
  // 这个 case 没有选定的那种打乱 → 退回 inv(整个 set 里只有一部分 case 有)
  const base = baseForKind(c, kind) ?? baseForKind(c, 'inv');
  if (!base) return '';

  // 起手随机 AUF(pre-AUF):打乱前先 U^k,case 不变(起手/收尾 AUF 同属一条轨道),
  // 但呈现相位不同。F2L 类 case 不加 —— 起手 U 会把 pair 挪走,变成另一个 case。
  const pre = opts?.preAuf ? pick(AUF) : '';

  if (puzzle === '3x3') {
    if (c.sticker.kind === 'f2l') {
      const yPre = pick(Y);
      return [yPre, base].filter(Boolean).join(' ');
    }
    // 收尾随机 AUF(post-AUF,默认开):同一个 case 每次呈现的朝向不同,练的是识别不是背图。
    // 对最优打乱也一样加 —— 多一步 U 不影响「它是最短打乱」这件事(长度在元数据弹窗里看),
    // 但少了它,这个 case 永远长同一个样。
    //
    // LSLL 也照加(2026-07-28 起)。它的打乱是按展示相位算的(`lsll/model.pairDisplayTurn`:
    // 角在槽正上方 / 棱侧色对齐中心),收尾 U 会把对子转离那一格 —— 但 case 没变(同一条
    // Z4×Z4 轨道,`tests/lsll_trainer_set` 逐个验过 16 种接法),而训练器各处的图都是从
    // **实际打乱**渲染的,跟着一起转,不会出现「图与题面对不上」。转出来的相位正是真解里要先
    // 补一个 AUF 才能开搞的样子,该练。想要恒定相位就把这个开关关掉。
    const post = pick(postAufPool(c, pre, base, 3, opts));
    return joinWithAufMerge(pre, base.split(/\s+/).filter(Boolean), post);
  }

  if (puzzle === '2x2') {
    const post = pick(postAufPool(c, pre, base, 2, opts));
    return joinWithAufMerge(pre, base.split(/\s+/).filter(Boolean), post);
  }

  /**
   * 金字塔:`inv` 就是库里的 setup 原文(最少步),`rand` 是本站默认(issue #64)——
   *
   *  ① 顶层随机转一下(PYRA_AUF)。金字塔的顶层没有「自动对齐」,真解里本来就要先补一个
   *     U / U' 才认得出 case;setup 原文永远把顶层摆正,等于把这一步免掉了。顶层转动只动
   *     顶层,槽位里那个没解开的棱一动不动 —— case 没变,只是相位不同(与三阶 post-AUF 同理),
   *     所以记忆模式(postAuf === false)不加:那边题面要与库里那张 case 图逐字一致。
   *  ② 换一条到达同一状态的随机长路径(≈10-15 步)。L4E 的 setup 多是 4-7 步最少步,
   *     照着打乱念一遍就把答案倒着背了一遍;长路径下摆出来的魔方一模一样,但反推不出来。
   *
   * 解不出来(状态不可达 / 记号不认识)时 `equivalentPyraScramble` 原样退回,不编假打乱。
   */
  if (puzzle === 'pyraminx') {
    if (kind !== 'rand') return base;
    const post = opts?.postAuf === false ? '' : pick(PYRA_AUF);
    return equivalentPyraScramble([base, post].filter(Boolean).join(' ')) || base;
  }

  return base;
}

/**
 * 纯打乱:只留转动。库里的 setup / 公式原文混着换握记号 `↑↓·`、上游标注 `=`/`*`、
 * FTN 注解块、分组括号 `(…)2` —— 打乱本身不需要这些(它们是给「怎么拧」用的标注),
 * 想照着念一遍打乱的人会被它们干扰。剥净 + 展开括号走全站唯一那份 `flattenAlg`。
 *
 * 顺带把 `R2'` 写成 `R2` —— 半圈转没有方向,撇只是上游作者的书写习惯,念打乱时纯噪音。
 *
 * 两处例外,都**原样返回 / 不改**:
 *  - sq1:`(1,0)/` 的括号和逗号**是招式本体**,展开就毁了。
 *  - megaminx:`R++` / `D--` 是另一套文法,`2'` 归一那条规则在这里没有意义,不碰。
 */
export function purifyScramble(puzzle: AlgPuzzle | undefined, s: string): string {
  if (!s || !puzzle || puzzle === 'sq1') return s;
  try {
    const flat = flattenAlg(s);
    // 只改 `2'`(`3Rw2'` 同理),**不碰其它角度**:`U3'` = `U'`,写成 `U3` 就是另一个招式。
    return puzzle === 'megaminx' ? flat : flat.replace(/2'/g, '2');
  } catch {
    return s;
  }
}
