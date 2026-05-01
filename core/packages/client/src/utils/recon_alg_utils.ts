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

/** 从文本前缀中提取纯公式（去注释行、行内注释、注解标记），用于计算步数
 *  NOTE: 对齐 legacy extractAlgFromRecon — 先跳过统计行头（如 '41STM ...'），再 cleanForPlayer
 */
export function extractAlgFromText(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  let startIdx = 0;
  // NOTE: 第一行如果是 "41STM ..." 格式的统计行，跳过
  if (lines.length > 0 && /^\d+STM\s/i.test(lines[0])) {
    startIdx = 1;
    // NOTE: 第二行如果不含 '//'，也是头部行（打乱），跳过
    if (lines.length > 1 && !lines[1].includes('//')) {
      startIdx = 2;
    }
  }
  const alg = lines.slice(startIdx)
    .map(line => {
      const idx = line.indexOf('//');
      return (idx >= 0 ? line.substring(0, idx) : line).trim();
    })
    .filter(line => line.length > 0)
    .join('\n');
  return cleanForPlayer(alg);
}

/**
 * 计算公式中的实际动画步数——展开 `(...)N` 重复组
 * NOTE: twisty-player 把 (R U R' U')2 当 8 步播放，但简单 split token 只数到 4。
 * 不展开会导致点击末尾时 moveCount < totalMoves，进度条停在动画结尾之前。
 */
export function countMovesExpanded(alg: string): number {
  if (!alg) return 0;
  let expanded = alg;
  let prev: string;
  // NOTE: 多次循环以处理嵌套，遇到不动点停止
  do {
    prev = expanded;
    expanded = expanded.replace(/\(([^()]*)\)(\d+)/g, (_, body: string, n: string) => {
      const reps = parseInt(n, 10);
      return Array(reps).fill(body.trim()).join(' ');
    });
  } while (expanded !== prev);
  return expanded.trim().split(/\s+/).filter(t => t.length > 0).length;
}

/** 根据步数同步 twisty-player 到对应的魔方状态 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function syncPlayerToMoveCount(player: any, moveCount: number) {
  if (!player) return;
  try {
    const model = player.experimentalModel;
    if (!model || !model.indexer) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model.indexer.get().then((indexer: any) => { 
      try {
        if (typeof indexer.indexToMoveStartTimestamp === 'function') {
          const totalMoves = typeof indexer.numAnimatedLeaves === 'function'
            ? indexer.numAnimatedLeaves()
            : (typeof indexer.numMoves === 'function' ? indexer.numMoves() : 0);
          if (moveCount >= totalMoves && typeof indexer.algDuration === 'function') {
            player.timestamp = indexer.algDuration();
          } else {
            player.timestamp = indexer.indexToMoveStartTimestamp(moveCount);
          }
        }
      } catch (e) {
        console.warn('[TwistySync] indexer callback error:', e);
      }
    }).catch((e: unknown) => console.warn('[TwistySync] indexer.get() rejected:', e));
  } catch (e) {
    console.warn('[TwistySync] experimentalModel access error:', e);
  }
}

// ── 自动加空格 ───────────────────────────────────────────────
// move 起始字符:面 R L U D F B / 中层 M E S / 旋转 x y z (大小写都算,小写= wide)
const MOVE_START_RE = /[RLUDFBMESxyzrludfbmes]/;
// move 末尾可能字符:任何面 / w / ' / 2
const MOVE_END_RE = /[RLUDFBMESwxyzrludfbmes'2]/;

/**
 * 用户敲一个字符时,如果造成相邻两个 move 没空格,在中间插一个空格。
 * 两种触发方向(用户既可能在 move 末尾追加新 move,也可能在 move 前插入新 move):
 *  - BEFORE: 前一字符是 move 末尾(face/w/'/2) + 新字符是 move 起始(face) → 在新字符前插空格
 *  - AFTER : 新字符是 move 末尾 + 后一字符是 move 起始 → 在新字符后插空格
 * 限制:
 *  - 仅 inputType === 'insertText' (手敲单字符) 触发;paste / IME / delete 不动
 *  - `//` 之后的注释段不动 (例如 "F2L 1" 不会被切成 "F2 L 1")
 * @returns 调整后的 value 与 cursor;若无需调整则按原样返回。
 */
export function autoSpaceMoves(
  value: string,
  cursor: number,
  inputType: string,
): { value: string; cursor: number } {
  if (inputType !== 'insertText') return { value, cursor };

  // 行内是否已经进入注释(// 在 newChar 之前出现)
  const inComment = (pos: number): boolean => {
    const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
    return value.slice(lineStart, pos).includes('//');
  };

  // BEFORE: 在新字符前插空格
  if (cursor >= 2) {
    const newChar = value[cursor - 1];
    const prevChar = value[cursor - 2];
    if (MOVE_START_RE.test(newChar) && MOVE_END_RE.test(prevChar) && !inComment(cursor - 1)) {
      value = value.slice(0, cursor - 1) + ' ' + value.slice(cursor - 1);
      cursor += 1;
    }
  }

  // AFTER: 在新字符后插空格
  if (cursor >= 1 && cursor < value.length) {
    const newChar = value[cursor - 1];
    const nextChar = value[cursor];
    if (MOVE_END_RE.test(newChar) && MOVE_START_RE.test(nextChar) && !inComment(cursor - 1)) {
      value = value.slice(0, cursor) + ' ' + value.slice(cursor);
      // 光标停在新字符与刚插入的空格之间(用户的"插入意图"完成,不跳过空格)
    }
  }

  return { value, cursor };
}

