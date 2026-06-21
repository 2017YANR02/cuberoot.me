/**
 * Alg text utilities — strip comments / zero-width chars, count expanded moves,
 * extract alg from recon-prefixed text. Ported from packages/client-vite/src/utils/recon_alg_utils.ts.
 */

const STRIP_TOKENS = new Set([
  '[regrip]', '[lockup]', '[freePair]', '[free_pair]',
  '[yRot]', '[y_rot]', '[sMove]', '[s_move]',
]);

const COMMENT_LINE_RE = /^\/\/.*/;

export function cleanForPlayer(text: string): string {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  const cleaned: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (COMMENT_LINE_RE.test(trimmed)) continue;
    const commentIdx = trimmed.indexOf('//');
    const effective = commentIdx >= 0 ? trimmed.substring(0, commentIdx).trim() : trimmed;
    if (!effective) continue;
    const tokens = effective.split(/\s+/).filter((t) => !STRIP_TOKENS.has(t));
    if (tokens.length > 0) {
      cleaned.push(tokens.join(' '));
    }
  }
  let alg = cleaned.join('\n');
  alg = alg.replace(/[.·↑↓⅓⅔​‌‍﻿]/g, '');
  alg = alg.replace(/\(([^)]*)\)(?!\d)/g, '$1');
  alg = alg.replace(/([RULDFBMESruldfbmesxyz][w]?2?'?)(?=[RULDFBMESruldfbmesxyz])/g, '$1 ');
  return alg;
}

export function cleanForAlgCubingNet(text: string): string {
  const cleaned = cleanForPlayer(text);
  return cleaned.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Sync a TwistyPlayer instance to a specific move count along its current alg. */
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
      } catch {
        /* indexer not ready / shape mismatch */
      }
    }).catch(() => { /* not ready */ });
  } catch {
    /* experimentalModel inaccessible (older cubing.js) */
  }
}

// ── Token position helpers (caret-driven sync) ──

export interface TokenPosition {
  start: number;
  end: number;
  text: string;
}

const TOKEN_RE = /[RUFLDBrufldbxyzMSE]w?[2']?'?/g;

export function findTokenPositions(text: string): TokenPosition[] {
  if (!text) return [];
  const tokens: TokenPosition[] = [];
  const lines = text.split('\n');
  let offset = 0;
  for (const line of lines) {
    const commentIdx = line.indexOf('//');
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
    offset += line.length + 1;
  }
  return tokens;
}

export function snapToTokenBoundary(cursorPos: number, positions: TokenPosition[]): number {
  if (positions.length === 0) return cursorPos;
  for (let i = 0; i < positions.length; i++) {
    const t = positions[i];
    if (cursorPos > t.start && cursorPos < t.end) {
      const prevEnd = i > 0 ? positions[i - 1].end : 0;
      const distPrev = cursorPos - prevEnd;
      const distEnd = t.end - cursorPos;
      return distPrev <= distEnd ? prevEnd : t.end;
    }
  }
  for (let j = positions.length - 1; j >= 0; j--) {
    if (cursorPos >= positions[j].end) {
      return positions[j].end;
    }
  }
  return 0;
}

export function countMovesExpanded(alg: string): number {
  if (!alg) return 0;
  let expanded = alg;
  let prev: string;
  do {
    prev = expanded;
    expanded = expanded.replace(/\(([^()]*)\)(\d+)/g, (_, body: string, n: string) => {
      const reps = parseInt(n, 10);
      return Array(reps).fill(body.trim()).join(' ');
    });
  } while (expanded !== prev);
  return expanded.trim().split(/\s+/).filter(t => t.length > 0).length;
}

export function extractAlgFromText(text: string): string {
  if (!text) return '';
  const lines = text.split('\n');
  let startIdx = 0;
  if (lines.length > 0 && /^\d+STM\s/i.test(lines[0])) {
    startIdx = 1;
    if (lines.length > 1 && !lines[1].includes('//')) {
      startIdx = 2;
    }
  }
  const alg = lines
    .slice(startIdx)
    .map((line) => {
      const idx = line.indexOf('//');
      return (idx >= 0 ? line.substring(0, idx) : line).trim();
    })
    .filter((line) => line.length > 0)
    .join('\n');
  return cleanForPlayer(alg);
}

/**
 * 规范化解法里的 `//` 注释标记:每行第一个 `//` 前后各**恰好**一个空格。
 * - `R//x` / `R  //  x` → `R // x`
 * - `R // x` (已规范) → 不变
 * - `// comment` 行首注释 → 保持无前导空格,但 trailing 空格规范为 1
 * - 一行多个 `//`:只处理第一个(第二个被视为注释文本里的内容)
 */
/**
 * 校验记号文本(解法 / 打乱)里的非法字符。
 * cube 记号区(每行 `//` 注释之外)只能用英文字母和符号(ASCII);中文等任何文字
 * 必须写在 `//` 之后当注释,否则播放器会把它当成转动 → 复盘无法播放。
 * 返回有问题的行(行号从 1 起 + 去注释后的记号片段 + 命中的非 ASCII 字符,去重),
 * 全部合法时返回空数组。
 */
export interface NotationViolation {
  line: number;
  snippet: string;
  chars: string;
}

export function findIllegalNotationChars(text: string): NotationViolation[] {
  if (!text) return [];
  const out: NotationViolation[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const commentIdx = lines[i].indexOf('//');
    const instr = commentIdx >= 0 ? lines[i].slice(0, commentIdx) : lines[i];
    const bad = new Set<string>();
    for (const ch of instr) {
      if ((ch.codePointAt(0) ?? 0) > 0x7f) bad.add(ch);
    }
    if (bad.size > 0) {
      out.push({ line: i + 1, snippet: instr.trim(), chars: [...bad].join(' ') });
    }
  }
  return out;
}

export function normalizeSolutionSlashes(text: string): string {
  return text.split('\n').map(line => {
    const idx = line.indexOf('//');
    if (idx < 0) return line;
    const before = line.slice(0, idx).replace(/[ \t]+$/, '');
    const after = line.slice(idx + 2).replace(/^[ \t]+/, '');
    return before === '' ? `// ${after}` : `${before} // ${after}`;
  }).join('\n');
}
