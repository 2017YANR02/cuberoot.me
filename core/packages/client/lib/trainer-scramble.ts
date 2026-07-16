// Ported from packages/client-vite/src/utils/trainerScramble.ts
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import { tr } from '@/i18n/tr';

const AUF = ['', 'U', 'U2', "U'"];
const Y = ['', 'y', 'y2', "y'"];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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
export type ScrambleKind = 'inv' | 'stm' | 'sqtm' | 'htm' | 'qtm' | 'coep';

/**
 * 选择器里的顺序与名字。`SH*` / `SQ*` / `H*` / `Q*` 是站长表里的列名(星号 = 最优),
 * 度量的学名在括号里 —— 表叫 SH/SQ,其实是 STM / SQTM(不是 HTM/QTM,那两个另有其列)。
 */
export const SCRAMBLE_KINDS: ReadonlyArray<{ id: ScrambleKind; label: () => string }> = [
  { id: 'inv', label: () => tr({ zh: '逆 case', en: 'Inv case' }) },
  { id: 'stm', label: () => `SH* (STM)` },
  { id: 'sqtm', label: () => `SQ* (SQTM)` },
  { id: 'htm', label: () => `H* (HTM)` },
  { id: 'qtm', label: () => `Q* (QTM)` },
  { id: 'coep', label: () => 'COEP' },
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
  if (kind !== 'inv') return c.meta?.optimal?.[kind]?.scramble ?? null;
  const baseAlg = c.algs.flat()[0]?.alg ?? c.standard ?? '';
  return (c.setup && c.setup.trim() ? c.setup.trim() : inverseAlg(baseAlg)) || null;
}

export function generateScramble(
  c: AlgCase,
  puzzle: AlgPuzzle,
  kind: ScrambleKind = 'inv',
  opts?: { preAuf?: boolean },
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
    // 收尾随机 AUF:同一个 case 每次呈现的朝向不同,练的是识别不是背图。
    // 对最优打乱也一样加 —— 多一步 U 不影响「它是最短打乱」这件事(长度在元数据弹窗里看),
    // 但少了它,这个 case 永远长同一个样。
    const post = pick(AUF);
    return [pre, base, post].filter(Boolean).join(' ').trim();
  }

  if (puzzle === '2x2') {
    const post = pick(AUF);
    return [pre, base, post].filter(Boolean).join(' ').trim();
  }

  return base;
}
