import { normalizeLines } from './recon_norm_cross';

const CROSS_RE = /\b(?:p?s?x*)?cross\b/i;

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const n = input.length;
  while (i < n) {
    const c = input[i];
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) {
      let token = c;
      let j = i + 1;
      if (j < n && input[j] === 'w') {
        token += 'w';
        j++;
      }
      while (j < n && (input[j] === '2' || input[j] === "'")) {
        token += input[j];
        j++;
      }
      tokens.push(token);
      i = j;
    } else {
      i++;
    }
  }
  return tokens;
}

function splitAlgComment(line: string): { alg: string; comment: string } {
  const idx = line.indexOf('//');
  if (idx < 0) return { alg: line, comment: '' };
  return { alg: line.slice(0, idx), comment: line.slice(idx).trim() };
}

export function findCrossLineIndex(solution: string): number {
  if (!solution) return -1;
  const lines = solution.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const { comment } = splitAlgComment(lines[i]);
    if (comment && CROSS_RE.test(comment)) return i;
  }
  return -1;
}

/** 仅当 cross 段（line 0 .. cross line）含宽转动（小写 r/l/u/d/f/b 或 Xw）时才返回 true */
export function hasWideMoveInCrossSection(solution: string): boolean {
  const idx = findCrossLineIndex(solution);
  if (idx < 0) return false;
  const lines = solution.split(/\r?\n/);
  for (let i = 0; i <= idx; i++) {
    const { alg } = splitAlgComment(lines[i]);
    for (const tok of tokenize(alg)) {
      const c = tok[0];
      // Xw 形式
      if (tok.length > 1 && tok[1] === 'w' && c >= 'A' && c <= 'Z') return true;
      // 小写宽转动（排除 x/y/z 整体转体）
      if (c === 'r' || c === 'l' || c === 'u' || c === 'd' || c === 'f' || c === 'b') return true;
    }
  }
  return false;
}

/**
 * 简化版：返回从开头到 cross 行的"完整归一化字符串"（按行）+ cross 行索引。
 * 仅用于 NormalizedCrossBlock（编辑页独立块）展示。
 */
export function extractAndNormalizeCross(
  solution: string,
): { alg: string; lineIndex: number } | null {
  const full = buildNormalizedSolution(solution);
  if (!full) return null;
  const idx = findCrossLineIndex(full);
  if (idx < 0) return null;
  const alg = full.split(/\r?\n/).slice(0, idx + 1).join('\n');
  return { alg, lineIndex: idx };
}

/**
 * 按行标准化：每行的 face moves 留在该行（按最终朝向重写），
 * rotations + wide-move 隐含的旋转都合到 prefix，prefix 落到第一条原本非空的 pre-cross 行。
 * cross 行后面的内容原样保留。
 */
export function buildNormalizedSolution(solution: string): string | null {
  if (!solution) return null;
  const lines = solution.split(/\r?\n/);

  let crossLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const { comment } = splitAlgComment(lines[i]);
    if (comment && CROSS_RE.test(comment)) {
      crossLineIdx = i;
      break;
    }
  }
  if (crossLineIdx < 0) return null;

  // 收集每行的 alg / comment / tokens
  const lineAlgs: string[] = [];
  const lineComments: string[] = [];
  const lineTokens: string[][] = [];
  for (let i = 0; i <= crossLineIdx; i++) {
    const { alg, comment } = splitAlgComment(lines[i]);
    lineAlgs.push(alg);
    lineComments.push(comment);
    lineTokens.push(tokenize(alg));
  }
  // 至少要有一行有 token，否则没意义
  if (!lineTokens.some(t => t.length > 0)) return null;

  let result;
  try {
    result = normalizeLines(lineTokens);
  } catch {
    return null;
  }
  const { prefix, perLine } = result;

  // prefix 落点：第一条原本含 alg 的行；都为空就放 cross 行
  let iPrefix = -1;
  for (let i = 0; i <= crossLineIdx; i++) {
    if (lineAlgs[i].trim()) { iPrefix = i; break; }
  }
  if (iPrefix < 0) iPrefix = crossLineIdx;

  const joinAlgComment = (alg: string, comment: string) =>
    alg ? (comment ? `${alg} ${comment}` : alg) : comment;

  const out = [...lines];
  for (let i = 0; i <= crossLineIdx; i++) {
    let algStr = perLine[i].join(' ');
    if (i === iPrefix && prefix.length > 0) {
      algStr = algStr ? `${prefix.join(' ')} ${algStr}` : prefix.join(' ');
    }
    out[i] = joinAlgComment(algStr, lineComments[i]);
  }

  return out.join('\n');
}
