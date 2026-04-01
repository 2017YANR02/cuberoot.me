/**
 * 公式工具——1:1 移植自 recon/recon_alg_utils.js（110 行）
 * NOTE: 提供 twisty-player 清洗、alg.cubing.net 清洗、光标磁吸等功能
 */

/**
 * 需要从解法文本中剥离的 token（twisty-player 不认识它们）
 * NOTE: 包括注解标记和阶段注释
 */
const STRIP_TOKENS = new Set([
  '[regrip]', '[lockup]', '[freePair]', '[free_pair]',
  '[yRot]', '[y_rot]', '[sMove]', '[s_move]',
]);

/** 阶段注释行正则 */
const COMMENT_LINE_RE = /^\/\/.*/;

/**
 * 清洗解法文本，使其可被 twisty-player 接受
 * - 移除注解标记 [regrip] 等
 * - 移除注释行（// 开头）
 * - 移除行内注释（// 后的内容）
 * - 保留换行（twisty-player 支持多行公式）
 */
export function cleanForPlayer(text: string): string {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  const cleaned: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // NOTE: 跳过纯注释行
    if (COMMENT_LINE_RE.test(trimmed)) continue;
    // NOTE: 截断行内注释
    const commentIdx = trimmed.indexOf('//');
    const effective = commentIdx >= 0 ? trimmed.substring(0, commentIdx).trim() : trimmed;
    if (!effective) continue;
    // NOTE: 移除注解标记
    const tokens = effective.split(/\s+/).filter(t => !STRIP_TOKENS.has(t));
    if (tokens.length > 0) {
      cleaned.push(tokens.join(' '));
    }
  }
  return cleaned.join('\n');
}

/**
 * 清洗解法文本，使其可被 alg.cubing.net 接受
 * 与 cleanForPlayer 类似，但还要移除换行（alg.cubing.net 用空格分隔）
 */
export function cleanForAlgCubingNet(text: string): string {
  const cleaned = cleanForPlayer(text);
  return cleaned.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── 光标磁吸 ──

/** Token 位置信息 */
export interface TokenPosition {
  /** 在原始文本中的起始索引 */
  start: number;
  /** 在原始文本中的结束索引（不含） */
  end: number;
  /** Token 内容 */
  text: string;
}

/**
 * 扫描文本中的所有 token（步骤）位置
 * NOTE: 用于实现光标在 token 边界上跳转
 */
export function findTokenPositions(text: string): TokenPosition[] {
  if (!text) return [];
  const positions: TokenPosition[] = [];
  // NOTE: 匹配所有非空白连续字符序列
  const re = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const token = match[0];
    // NOTE: 跳过注解标记和注释行
    if (STRIP_TOKENS.has(token)) continue;
    if (token.startsWith('//')) {
      // NOTE: 跳到行尾
      const lineEnd = text.indexOf('\n', match.index);
      if (lineEnd > 0) re.lastIndex = lineEnd;
      continue;
    }
    positions.push({
      start: match.index,
      end: match.index + token.length,
      text: token,
    });
  }
  return positions;
}

/**
 * 将光标位置磁吸到最近的 token 边界
 * NOTE: 光标在两个 token 之间时，吸附到较近的一侧
 * @param cursorPos 当前光标位置
 * @param positions token 位置列表
 * @returns 磁吸后的光标位置
 */
export function snapToTokenBoundary(cursorPos: number, positions: TokenPosition[]): number {
  if (positions.length === 0) return cursorPos;

  // NOTE: 在第一个 token 之前
  if (cursorPos <= positions[0].start) return positions[0].start;

  // NOTE: 在最后一个 token 之后
  const last = positions[positions.length - 1];
  if (cursorPos >= last.end) return last.end;

  // NOTE: 找到光标所在的 token 间隙
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    // NOTE: 光标在 token 内——不磁吸
    if (cursorPos >= pos.start && cursorPos <= pos.end) return cursorPos;

    // NOTE: 光标在 token[i].end 和 token[i+1].start 之间
    if (i < positions.length - 1) {
      const next = positions[i + 1];
      if (cursorPos > pos.end && cursorPos < next.start) {
        // NOTE: 吸附到较近的一侧
        const distToEnd = cursorPos - pos.end;
        const distToNext = next.start - cursorPos;
        return distToEnd <= distToNext ? pos.end : next.start;
      }
    }
  }
  return cursorPos;
}
