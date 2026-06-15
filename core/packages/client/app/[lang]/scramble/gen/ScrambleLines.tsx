'use client';

/**
 * Render a scramble string with PDF-style line layout:
 *   - tokens NBSP-padded to maxLen for grid alignment (mirrors tnoodle
 *     `splitToTokens`)
 *   - mega: lines come from injected '\n' (7 face cycles)
 *   - sq1: break at each '/'
 *   - everything else: chunk every 12 tokens per line (rough average of
 *     what tnoodle's PDF produces for NxN at typical font sizes)
 *   - when line count ≥ MIN_LINES_HIGHLIGHTING, every other line gets the
 *     light-gray background (#E6E6E6 = PDF SCRAMBLE_HIGHLIGHTING_COLOR)
 *
 * Used by Quick + TNoodle modes so the on-screen scramble closely tracks
 * the printed sheet.
 */

const MIN_LINES_HIGHLIGHTING = 4;       // tnoodle constant
const TOKENS_PER_LINE_GENERIC = 12;     // chunk size for NxN / pyra / skewb / clock
const SQ1_TURNS_PER_LINE = 4;           // sq1 turns ((x,y) /) per line — matches tnoodle PDF
const NBSP = ' ';

import type { ReactNode } from 'react';

interface Props {
  scramble: string;
  /** Optional className passed through to the wrapping element. */
  className?: string;
  /** Optional inline node rendered as the LAST child INSIDE the <code>, after
   *  the scramble text (e.g. the per-row step badge). Floated right via CSS so
   *  it trails the scramble's last wrapped line instead of dropping below. */
  trailing?: ReactNode;
}

function buildLines(scramble: string): string[] {
  const trimmed = scramble.trim();
  if (!trimmed) return [];

  // Mega has explicit '\n' boundaries; preserve them as line breaks.
  let lineSegments: string[][] | null = null;
  let allTokens: string[];
  if (trimmed.includes('\n')) {
    lineSegments = trimmed
      .split('\n')
      .map((l) => l.trim().split(/\s+/).filter(Boolean));
    allTokens = lineSegments.flat();
  } else {
    allTokens = trimmed.split(/\s+/).filter(Boolean);
  }
  if (allTokens.length === 0) return [];

  // NBSP-pad every token to the longest token's width — except '/' (sq1
  // separator stays bare so it doesn't grow into a wide gap).
  const padTargets = allTokens.filter((t) => t !== '/');
  const maxLen = padTargets.length > 0 ? Math.max(...padTargets.map((t) => t.length)) : 0;
  const pad = (t: string) => t === '/' ? t : t + NBSP.repeat(Math.max(0, maxLen - t.length));

  if (lineSegments) {
    return lineSegments.map((toks) => toks.map(pad).join(' '));
  }
  if (allTokens.includes('/')) {
    // sq1: tokens look like  (x,y) / (x,y) / ...  → group N turns per line.
    // A "turn" ends at each '/'. Pack SQ1_TURNS_PER_LINE turns per line.
    const out: string[] = [];
    let cur: string[] = [];
    let turnCount = 0;
    for (const tok of allTokens) {
      cur.push(pad(tok));
      if (tok === '/') {
        turnCount += 1;
        if (turnCount >= SQ1_TURNS_PER_LINE) {
          out.push(cur.join(' '));
          cur = [];
          turnCount = 0;
        }
      }
    }
    if (cur.length) out.push(cur.join(' '));
    return out;
  }
  // 通用 NxN/pyra/skewb/clock:不再预分块。整段 NBSP-padded tokens 给浏览器自然换行,
  // 这样窄屏 cell 不会出现"半行尾部留白"(写死 12 token/行 在手机上撑爆 → 浏览器二次
  // wrap → 后半截只剩 3-4 个 token 留一片空白)。
  void TOKENS_PER_LINE_GENERIC;
  return [allTokens.map(pad).join(' ')];
}

export default function ScrambleLines({ scramble, className, trailing }: Props) {
  const lines = buildLines(scramble);
  if (lines.length === 0) return <code className={className}>{trailing}</code>;
  if (lines.length === 1) {
    return <code className={className}>{lines[0]}{trailing}</code>;
  }
  // 不再走 PDF 风格的隔行灰底(MIN_LINES_HIGHLIGHTING 旧逻辑)。多行
  // (mega / sq1)纯文本换行即可,跟 PDF 三阶的"无 highlighting"对齐。
  void MIN_LINES_HIGHLIGHTING;
  return (
    <code className={className}>
      {lines.map((line, i) => (
        <span key={i} className="gen-scramble-line">{line}</span>
      ))}
      {trailing}
    </code>
  );
}
