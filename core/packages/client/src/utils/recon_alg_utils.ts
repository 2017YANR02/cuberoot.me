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
  // ​-‍﻿ 是零宽字符（cubedb 分享 / AI 输出 / 剪贴板会夹带），
  // 不剥的话 cubing.js Alg parser 整段判错 → 动画停在打乱状态
  alg = alg.replace(/[.·↑↓⅓⅔​‌‍﻿]/g, '');
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

// 公式自动加空格 — 实现已挪到 utils/alg_autospace.ts,这里 re-export 保持向后兼容
export { autoSpaceMoves } from './alg_autospace';

