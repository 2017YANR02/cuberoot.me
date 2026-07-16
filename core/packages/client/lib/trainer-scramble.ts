// Ported from packages/client-vite/src/utils/trainerScramble.ts
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import { tr } from '@/i18n/tr';

const AUF = ['', 'U', 'U2', "U'"];
const Y = ['', 'y', 'y2', "y'"];

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
export type ScrambleKind = 'inv' | 'cstimer' | 'stm' | 'sqtm' | 'htm' | 'qtm' | 'coep';

/**
 * 选择器里的顺序与名字。`SH*` / `SQ*` / `H*` / `Q*` 是站长表里的列名(星号 = 最优),
 * 度量的学名在括号里 —— 表叫 SH/SQ,其实是 STM / SQTM(不是 HTM/QTM,那两个另有其列)。
 * `cstimer` = 随机态求解器风格(同 cstimer 训练打乱:现算 ≈20 步全脸序列),仅 3x3。
 */
export const SCRAMBLE_KINDS: ReadonlyArray<{ id: ScrambleKind; label: () => string }> = [
  { id: 'htm', label: () => `H* (HTM)` },
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

export function generateScramble(
  c: AlgCase,
  puzzle: AlgPuzzle,
  kind: ScrambleKind = 'inv',
  opts?: { preAuf?: boolean; postAuf?: boolean },
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
    const post = opts?.postAuf === false ? '' : pick(AUF);
    return joinWithAufMerge(pre, base.split(/\s+/).filter(Boolean), post);
  }

  if (puzzle === '2x2') {
    const post = opts?.postAuf === false ? '' : pick(AUF);
    return joinWithAufMerge(pre, base.split(/\s+/).filter(Boolean), post);
  }

  return base;
}
