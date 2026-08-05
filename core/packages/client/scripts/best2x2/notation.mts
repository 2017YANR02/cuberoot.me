/**
 * 表格记号 → 站内记号。**只做表格特有的脏写法**,真正的解析一律交给
 * `@cuberoot/shared/alg-notation`(剥括号 / 展开 `(...)N` / 连写切分 / 取逆)——
 * 这一层不许再写第二个 tokenizer。
 *
 * 全表实测出来的脏写法就这几类(普查见 docs/best-2x2-algs-port.md §3):
 *
 *   ’ ´ ` ′        弯引号 / 重音符当撇用          → '
 *   (U/U')         起手 AUF 「哪个都行」         → 展开成 U / U' 两条
 *   R/R3'  F2/D    同一步给了两种写法            → 两支都展开
 *   R'.            句号跟在末步后面              → 去掉
 *   U2' R2'        半圈带撇                      → 站内 tokenizer 认,原样放过
 *
 * 斜杠是公式分支,不是注释。这里做笛卡尔展开并保留来源标记;后面状态校验会逐支判断,
 * 绝不替表格作者擅自挑一边。
 */
import { flattenAlg, tokenizeMoves, toMoveString } from '@cuberoot/shared/alg-notation';

export interface Sanitized {
  /** 归一后的公式(空格分词,无括号)。 */
  alg: string;
  /** 表格原文。 */
  raw: string;
  /** 起手 AUF 表里写作「U 或 U'」。 */
  eitherAuf: boolean;
  /** 本条选中的分支;没有斜杠时为空。 */
  choices: string[];
  /** 同一来源共展开出多少条,以及本条是第几条。 */
  variant: number;
  variants: number;
}

const QUOTES = /[‘’ʼ´`′＇]/g;
const EITHER_AUF = /\(\s*(U(?:2)?'?)\s*\/\s*(U(?:2)?'?)\s*\)/g;
const MOVE_CHOICE = /([URFDLBxyz]\d*'?)\/([URFDLBxyz]\d*'?)(?=\s|$|\))/g;

export class SheetNotationError extends Error {}

interface Branch { text: string; choices: string[]; eitherAuf: boolean }

function expandPattern(branches: Branch[], pattern: RegExp, marksAuf: boolean): Branch[] {
  const out: Branch[] = [];
  for (const branch of branches) {
    pattern.lastIndex = 0;
    const match = pattern.exec(branch.text);
    if (!match) { out.push(branch); continue; }
    const before = branch.text.slice(0, match.index);
    const after = branch.text.slice(match.index + match[0].length);
    for (const choice of [match[1], match[2]]) {
      out.push(...expandPattern([{
        text: before + choice + after,
        choices: [...branch.choices, choice],
        eitherAuf: branch.eitherAuf || marksAuf,
      }], pattern, marksAuf));
    }
  }
  return out;
}

function normalizeBranch(raw: string, branch: Branch): Omit<Sanitized, 'variant' | 'variants'> {
  const { junk } = tokenizeMoves(flattenAlg(branch.text));
  if (junk.length) throw new SheetNotationError(`认不出来的记号 ${JSON.stringify(junk)}(原文 ${JSON.stringify(raw)})`);

  const alg = toMoveString(branch.text);
  if (!alg) throw new SheetNotationError(`空公式(原文 ${JSON.stringify(raw)})`);
  return { alg, raw, eitherAuf: branch.eitherAuf, choices: branch.choices };
}

/** 表格原文 → 站内公式串列表。斜杠逐支展开;认不出来就抛,绝不静默丢公式。 */
export function expandAlg(raw: string): Sanitized[] {
  let s = raw.replace(QUOTES, "'").replace(/\s+/g, ' ').trim();
  s = s.replace(/\.(?=\s|$)/g, '');          // 末步后的句号

  let branches: Branch[] = [{ text: s, choices: [], eitherAuf: false }];
  branches = expandPattern(branches, EITHER_AUF, true);
  branches = expandPattern(branches, MOVE_CHOICE, false);
  const normalized = branches.map((branch) => normalizeBranch(raw, branch));
  const unique = normalized.filter((item, index, all) =>
    all.findIndex((other) => other.alg === item.alg) === index);
  return unique.map((item, variant) => ({ ...item, variant, variants: unique.length }));
}

/** 兼容只接受单条的调用方;有分支时明确抛错,避免重新引入“默认拿左支”。 */
export function sanitizeAlg(raw: string): Sanitized {
  const expanded = expandAlg(raw);
  if (expanded.length !== 1) {
    throw new SheetNotationError(`公式含 ${expanded.length} 个分支,请用 expandAlg(原文 ${JSON.stringify(raw)})`);
  }
  return expanded[0];
}

/** 版式层的判据:这一格是公式还是列注记 / 说明文字。 */
export function isAlgLike(text: string): boolean {
  try {
    expandAlg(text);
    return true;
  } catch {
    return false;
  }
}
