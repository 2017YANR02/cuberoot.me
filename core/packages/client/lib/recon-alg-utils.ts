/**
 * Alg text utilities — strip comments / zero-width chars, count expanded moves,
 * extract alg from recon-prefixed text. Ported from packages/client-vite/src/utils/recon_alg_utils.ts.
 */
import { etm } from '@cuberoot/shared/alg-notation';
import { wastedDisplaySpans } from '@cuberoot/shared/timer/reconstruct/error-detect';
import { parseSq1Tokens } from '@cuberoot/shared/sq1-notation';
import { orientedFaceColors, orientationForBottomFace } from '@/lib/cube-orientation';
import { CUBE_COLOR_LETTER_FOR_FACE, CUBE_FACE_FOR_COLOR_LETTER } from '@/lib/cube-colors';
import { crossColorFromReconText } from '@cuberoot/timer-ui/CubeColorChip';
import {
  cleanReconAlgForPlayer,
  expandReconGroupRepeats,
  normalizeReconSolution,
} from '@cuberoot/shared/recon-completion';

/**
 * 装饰性标注字符:`·`(间隔)、`↑↓`(方向 / regrip 记号)、分数 `⅓⅔`、ASCII `.`、各类零宽字符。
 * 这些都不是真转动 —— cleanForPlayer 喂播放器前会静默剥掉,findIllegalNotationChars 校验也
 * 据此放行(否则「非 ASCII = 非法」会把它们拦下、提交被拒)。两处共用同一来源,改一处即可。
 */
const COSMETIC_ANNOTATION_CHARS = '.·↑↓⅓⅔​‌‍﻿';

/**
 * 展开分组重复记号 `(...)N` → 把括号里的招式重复 N 遍(内层优先,迭代到不动点,支持嵌套)。
 * `(R' F R F')2` → `R' F R F' R' F R F'`。countMovesExpanded 与 cleanForPlayer 共用同一份展开,
 * 保证步数统计、外链、播放器三方口径一致。
 */
export function expandGroupRepeats(alg: string): string {
  return expandReconGroupRepeats(alg);
}

export function cleanForPlayer(text: string): string {
  return cleanReconAlgForPlayer(text);
}

/** Stage masks follow the reconstruction's bottom, independently of playback position. */
export function reconPlaybackOrientation(text: string): string {
  const color = crossColorFromReconText(text);
  if (color) return orientationForBottomFace(CUBE_FACE_FOR_COLOR_LETTER[color]);
  const rotations: string[] = [];
  for (const move of cleanForPlayer(text).split(/\s+/).filter(Boolean)) {
    if (!/^[xyz](?:2'?|')?$/.test(move)) break;
    rotations.push(move.replace(/2'/g, '2'));
  }
  return orientationForBottomFace(orientedFaceColors(rotations.join(' ')).D);
}

/** Row boundaries in the same expanded token coordinates as the NxN player.
 * Inspection rotations belong to the first solve segment. */
export function reconPlaybackSegments(text: string): number[] {
  const ends: number[] = [];
  let prefix = '';
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    prefix += line + '\n';
    const moves = cleanForPlayer(line).split(/\s+/).filter(Boolean);
    if (!moves.some(move => !/^[xyz][2']*$/i.test(move))) continue;
    const end = cleanForPlayer(prefix).split(/\s+/).filter(Boolean).length;
    if (end > (ends.at(-1) ?? 0)) ends.push(end);
  }
  return ends;
}

export function cleanForAlgCubingNet(text: string): string {
  const cleaned = cleanForPlayer(text);
  return cleaned.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Display-only U/F colors after initial inspection rotations; never change source text. */
export function reconInspectionOrientations(text: string): { line: number; offset: number; colors: string }[] {
  const result: { line: number; offset: number; colors: string }[] = [];
  let rotations = '';
  let offset = 0;
  for (const [line, content] of text.split('\n').entries()) {
    const moves = cleanForAlgCubingNet(content);
    // Once solving begins, a later "insp" label is not an initial orientation.
    if (moves && !/^(?:[xyz](?:2'?|')?\s*)+$/.test(moves)) break;
    rotations += ` ${moves.replace(/2'/g, '2')}`;
    const label = /\/\/\s*insp\s*$/i.exec(content);
    if (label) {
      const shown = orientedFaceColors(rotations);
      result.push({ line, offset: offset + content.trimEnd().length,
        colors: `${CUBE_COLOR_LETTER_FOR_FACE[shown.U]}${CUBE_COLOR_LETTER_FOR_FACE[shown.F]}` });
    }
    offset += content.length + 1;
  }
  return result;
}

/** Sync a TwistyPlayer instance to a specific move count along its current alg. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function syncPlayerToMoveCount(player: any, moveCount: number, autoplay = false) {
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
          if (autoplay) player.play?.();
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

/** Display decorations indexed into the unchanged source; never feed these to playback. */
export function reconWasteBrackets(text: string, scramble: string): Map<number, string> {
  const markers = new Map<number, string>();
  const code = text.replace(/\/\/[^\n]*/g, comment => ' '.repeat(comment.length));
  // Repeated groups/commutators do not have a one-to-one source-to-move mapping.
  if (/[\[\]:,]/.test(code) || /\)\s*\d/.test(code)) return markers;
  const tokens = findTokenPositions(text);
  if (!tokens.length || /[^\s()]/.test(code.replace(TOKEN_RE, ''))) return markers;
  const manual: Array<[number, number]> = [];
  const stack: number[] = [];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '(') stack.push(i);
    else if (code[i] === ')' && stack.length) manual.push([stack.pop()!, i]);
  }
  // Unfinished user annotations should not acquire a second set of brackets.
  if (stack.length) return markers;
  const moves = tokens.map((token, ts) => ({ m: token.text, ts }));
  for (const span of wastedDisplaySpans(cleanForPlayer(scramble), moves)) {
    const start = tokens[span.fromIdx].start;
    const end = tokens[span.toIdx].end;
    if (manual.some(([a, b]) => a < end && b >= start)) continue;
    markers.set(start, (markers.get(start) ?? '') + '(');
    markers.set(end, ')' + (markers.get(end) ?? ''));
  }
  return markers;
}

/** Every whitespace-delimited run, with its position in `text` — mirrors the
 *  `text.trim().split(/\s+/)` tokenization every engine-puzzle move parser
 *  (Ivy / Dino / Redi / Rex / Heli / Skewb / Pyraminx / Megaminx / FTO) uses,
 *  so index N here lines up with move N as long as every token is valid. */
export function findWhitespaceTokenPositions(text: string): TokenPosition[] {
  if (!text) return [];
  const tokens: TokenPosition[] = [];
  const RE = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(text)) !== null) {
    tokens.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
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

/**
 * 招式数(ETM:每个 token 记 1,**转体也算**)—— 播放器的步进索引就是这个口径。
 *
 * 走 shared 的 tokenizer 而不是按空白分词:表和用户都会写无空格连写(`M'R'`、`U'D'`),
 * 按空白数会把它们数成 1 步,播放器就跟公式错位了。
 */
export function countMovesExpanded(alg: string): number {
  return etm(alg);
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
 * 例外:装饰性标注字符(`↑↓·` 等 COSMETIC_ANNOTATION_CHARS)放行 —— 播放器会静默剥掉,不影响复盘。
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
      if ((ch.codePointAt(0) ?? 0) > 0x7f && !COSMETIC_ANNOTATION_CHARS.includes(ch)) bad.add(ch);
    }
    if (bad.size > 0) {
      out.push({ line: i + 1, snippet: instr.trim(), chars: [...bad].join(' ') });
    }
  }
  return out;
}

/**
 * Caret-driven player scrub, dispatched by the player instance's `__kind`
 * (set by whichever engine mounted: Sq1ReconPlayer / CuberReconPlayer / plain
 * cubing.js TwistySection). Shared by the recon submit form and the
 * add/edit-alternative form via ReconPlayerPane + ReconSolutionField.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function syncReconPlayerCursorFromText(player: any, textBeforeCaret: string, autoplay = false): void {
  if (!player) return;
  if (player.__kind === 'sq1') {
    player.jumpToMoveCount?.(parseSq1Tokens(textBeforeCaret).length, autoplay);
    return;
  }
  const algBefore = extractAlgFromText(textBeforeCaret);
  const moves = algBefore.trim().split(/\s+/).filter((s) => s.length > 0);
  if (player.__kind === 'nxn-cuber') {
    player.jumpToMoveCount?.(moves.length, autoplay);
    return;
  }
  syncPlayerToMoveCount(player, countMovesExpanded(algBefore), autoplay);
}

export function normalizeSolutionSlashes(text: string): string {
  return normalizeReconSolution(text);
}
