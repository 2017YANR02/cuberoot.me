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
const NBSP = ' ';

interface Props {
  scramble: string;
  /** Optional className passed through to the wrapping element. */
  className?: string;
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
  const out: string[] = [];
  for (let i = 0; i < allTokens.length; i += TOKENS_PER_LINE_GENERIC) {
    out.push(
      allTokens.slice(i, i + TOKENS_PER_LINE_GENERIC).map(pad).join(' '),
    );
  }
  return out;
}

export default function ScrambleLines({ scramble, className }: Props) {
  const lines = buildLines(scramble);
  if (lines.length === 0) return <code className={className} />;
  if (lines.length === 1) {
    return <code className={className}>{lines[0]}</code>;
  }
  const hl = lines.length >= MIN_LINES_HIGHLIGHTING;
  return (
    <code className={className}>
      {lines.map((line, i) => (
        <span
          key={i}
          className={`gen-scramble-line${hl && i % 2 === 1 ? ' is-hl' : ''}`}
        >
          {line}
        </span>
      ))}
    </code>
  );
}
