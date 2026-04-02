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
  let alg = cleaned.join('\n');
  // NOTE: 从 legacy cleanForPlayer 迁移——删除 twisty-player 无法解析的特殊字符
  // .·↑↓⅓⅔ 分别是卡顿标记、换手标记、分数标记等
  alg = alg.replace(/[.·↑↓⅓⅔]/g, '');
  // NOTE: 保留重复标记 (...)N（twisty-player 支持），仅删除纯分组括号
  alg = alg.replace(/\(([^)]*)\)(?!\d)/g, '$1');
  // NOTE: 在连写的步骤之间插入空格（如 UD → U D，twisty-player 无法解析连写步骤）
  alg = alg.replace(/([RULDFBMESruldfbmesxyz][w]?2?'?)(?=[RULDFBMESruldfbmesxyz])/g, '$1 ');
  return alg;
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

// NOTE: 魔方指令 token 正则（对齐 legacy TOKEN_RE）
// 匹配: R, R', R2, R2', x, y2, Rw, Rw', Rw2 等
const TOKEN_RE = /[RUFLDBrufldbxyzMSE]w?[2']?'?/g;

/**
 * 扫描文本的非注释区域，返回所有 token 的位置数组
 * NOTE: 对齐 legacy recon_alg_utils.js findTokenPositions
 * - 只匹配魔方步骤 token（R, R', U2 等），不匹配注释文字
 * - 跳过每行 // 之后的内容
 */
export function findTokenPositions(text: string): TokenPosition[] {
  if (!text) return [];
  const tokens: TokenPosition[] = [];
  const lines = text.split('\n');
  let offset = 0;
  for (const line of lines) {
    const commentIdx = line.indexOf('//');
    // NOTE: 只扫描 // 之前的部分（非注释区）
    const instrPart = commentIdx >= 0 ? line.substring(0, commentIdx) : line;
    TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TOKEN_RE.exec(instrPart)) !== null) {
      tokens.push({
        start: offset + m.index,
        end: offset + m.index + m[0].length,
        text: m[0],
      });
    }
    offset += line.length + 1; // +1 for \n
  }
  return tokens;
}

/**
 * 将光标位置磁吸到最近的 token 边界
 * NOTE: 对齐 legacy recon_alg_utils.js snapToTokenBoundary
 * - 光标在 token 内部 → 吸附到该 token 的 end 或前一个 token 的 end（取更近的）
 * - 光标不在任何 token 内部 → 吸附到前一个 token 的 end
 * - 在第一个 token 之前 → 返回 0
 * 语义：光标位置表示"已执行到此处"，所以停在 token 末尾
 */
export function snapToTokenBoundary(cursorPos: number, positions: TokenPosition[]): number {
  if (positions.length === 0) return cursorPos;

  // NOTE: 光标在 token 内部 → 吸附到更近的 end（前进到执行完该步）或前一个 token 的 end
  for (let i = 0; i < positions.length; i++) {
    const t = positions[i];
    if (cursorPos > t.start && cursorPos < t.end) {
      const prevEnd = i > 0 ? positions[i - 1].end : 0;
      const distPrev = cursorPos - prevEnd;
      const distEnd = t.end - cursorPos;
      return distPrev <= distEnd ? prevEnd : t.end;
    }
  }

  // NOTE: 不在任何 token 内部 → 吸附到前一个 token 的 end
  // 语义：光标表示"已执行到此处"，所以停在前一步的末尾
  for (let j = positions.length - 1; j >= 0; j--) {
    if (cursorPos >= positions[j].end) {
      return positions[j].end;
    }
  }

  // NOTE: 在第一个 token 之前
  return 0;
}
