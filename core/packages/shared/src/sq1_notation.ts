/**
 * Square-1 notation + state — the single source for sq1 alg text across the
 * repo (client pages, server sr_render, scramble-stats-build). Token grammar
 * and state application are a TS port of tnoodle-lib `SquareOnePuzzle.java`.
 *
 * Provides:
 *   - parseSq1Tokens / SQ1_TOKEN_RE — canonical tokenizer, all formats
 *   - invertSq1Alg / canonicalSq1Alg / compactSq1Alg / compactSq1Solution
 *   - simplifySq1Alg — cancel redundant moves ("消步")
 *   - formatScrambleForEvent / displaySq1ForEvent — event-keyed display forms
 *   - applySq1Scramble — 24-position piece state + sliceSolved flag
 *
 * SVG rendering of the state lives client-side in `client/lib/sq1-svg.ts`.
 */

/** Tokenizer regex for sq1 alg. Three branches:
 *    1. `/`                  slice
 *    2. (t,b) pair           `(1,0)`, `1,0`, `(1 0)`, `1 0`, `10`, `3-3`, ...
 *    3. single t shorthand   `(3)`, `3`, `-3`   → means `(t, 0)` (top-only)
 *  Pair branch comes before single so existing forms like `10`/`30` still
 *  parse as `(1,0)`/`(3,0)` via greedy backtrack, not as a single number.
 *  The pair `(?:,\s*|\s+|(?=-?\d))` group allows zero-width separation when
 *  the next char is `-` or a digit. Sq1 turns are practically [-5, 6] so the
 *  single-digit fallback is unambiguous in real algs.
 *  Groups: 1=`/`, 2,3=pair top/bot, 4=single top (bot implicitly 0). */
export const SQ1_TOKEN_RE = /(\/)|\(?\s*(-?\d+)\s*(?:,\s*|\s+|(?=-?\d))(-?\d+)\s*\)?|\(?\s*(-?\d+)\s*\)?/g;

export type Sq1Token =
  | { kind: 'slice' }
  | { kind: 'turn'; top: number; bot: number };

/** Single canonical tokenizer — every sq1 alg consumer should go through here
 *  so format support stays in lockstep. */
export function parseSq1Tokens(alg: string): Sq1Token[] {
  // Strip `// …` line comments first so they don't parse as two `/` slices.
  const cleaned = alg.replace(/\/\/[^\n]*/g, ' ');
  const out: Sq1Token[] = [];
  const re = new RegExp(SQ1_TOKEN_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    if (m[1] === '/') out.push({ kind: 'slice' });
    else if (m[2] !== undefined) out.push({ kind: 'turn', top: parseInt(m[2], 10), bot: parseInt(m[3]!, 10) });
    else out.push({ kind: 'turn', top: parseInt(m[4]!, 10), bot: 0 });
  }
  return out;
}

/** Inverse a sq1 alg: reverse order, negate each (t,b); `/` stays.
 *  Output uses canonical `(t,b)` form regardless of input formatting. */
export function invertSq1Alg(alg: string): string {
  return parseSq1Tokens(alg).reverse().map((tok) =>
    tok.kind === 'slice' ? '/' : `(${-tok.top},${-tok.bot})`,
  ).join('');
}

/** Re-emit a sq1 alg in canonical `(t, b) / (t, b) / ...` form.
 *  Use this when handing the alg to cubing.js TwistyPlayer — its sq1 parser requires
 *  spaces around `/` AND after each comma. Without them: `Unexpected character at index N`. */
export function canonicalSq1Alg(alg: string): string {
  return parseSq1Tokens(alg).map((tok) =>
    tok.kind === 'slice' ? '/' : `(${tok.top}, ${tok.bot})`,
  ).join(' ');
}

/** Re-emit a sq1 alg in compact `tb/tb/...` form (no parens, no commas, no spaces).
 *  `(t, 0)` 简成 single `t` 仅当两侧都是 `/` (或字符串边界) —— 真 WCA 打乱 turn/slice
 *  必交替,总成立。否则保留 `tb`,免 `35/3/` 类左边界缺失 → `353/` 被 greedy 当成
 *  `(35, 3) /`。两 turn 中间没 `/` 的非 WCA 输入仍可能歧义 (e.g. `(3,0)(3,0)` →
 *  `3030` → `(303, 0)`);compact 只为 canonical scramble 显示用。
 *  DISPLAY only — safe round-trip iff every |t|, |b| ≤ 9 (sq1 turns are [-5..6] in practice). */
export function compactSq1Alg(alg: string): string {
  const toks = parseSq1Tokens(alg);
  return toks.map((tok, i) => {
    if (tok.kind === 'slice') return '/';
    const prev = toks[i - 1];
    const next = toks[i + 1];
    const leftBound = !prev || prev.kind === 'slice';
    const rightBound = !next || next.kind === 'slice';
    if (tok.bot === 0 && leftBound && rightBound) return `${tok.top}`;
    return `${tok.top}${tok.bot}`;
  }).join('');
}

/**
 * Compact a multi-line annotated SQ1 reconstruction (e.g. recon solution text)
 * to shorthand per line, preserving `// comment` suffixes and line breaks —
 * unlike compactSq1Alg, which drops comments and joins everything into one line.
 */
export function compactSq1Solution(text: string): string {
  return text.split(/\r?\n/).map((line) => {
    const idx = line.indexOf('//');
    const movePart = idx >= 0 ? line.slice(0, idx) : line;
    const comment = idx >= 0 ? line.slice(idx) : '';
    const compact = compactSq1Alg(movePart);
    if (!compact) return comment;
    return comment ? `${compact} ${comment}` : compact;
  }).join('\n');
}

/** Normalize a layer-turn amount to (-6, 6] (mod 12; 12 units = a full turn). */
function normSq1Turn(x: number): number {
  let v = ((x % 12) + 12) % 12;
  if (v > 6) v -= 12;
  return v;
}

/**
 * Cancel redundant Square-1 moves ("消步"): two adjacent slices annihilate, and
 * consecutive layer turns (no slice between) merge per layer mod 12, dropping
 * any that reduce to (0, 0). `// comments` are stripped (parseSq1Tokens drops
 * them), so e.g. `(0,-6) (0,6)//` collapses to the empty string.
 */
export function simplifySq1Alg(alg: string, format: 'compact' | 'wca' = 'compact'): string {
  const stack: Sq1Token[] = [];
  for (const tok of parseSq1Tokens(alg)) {
    const top = stack[stack.length - 1];
    if (tok.kind === 'slice') {
      if (top && top.kind === 'slice') stack.pop();
      else stack.push(tok);
    } else if (top && top.kind === 'turn') {
      const t = normSq1Turn(top.top + tok.top);
      const b = normSq1Turn(top.bot + tok.bot);
      if (t === 0 && b === 0) stack.pop();
      else stack[stack.length - 1] = { kind: 'turn', top: t, bot: b };
    } else {
      const t = normSq1Turn(tok.top);
      const b = normSq1Turn(tok.bot);
      if (t !== 0 || b !== 0) stack.push({ kind: 'turn', top: t, bot: b });
    }
  }
  const canonical = stack.map((tok) =>
    tok.kind === 'slice' ? '/' : `(${tok.top}, ${tok.bot})`,
  ).join(' ');
  return format === 'wca' ? canonicalSq1Alg(canonical) : compactSq1Alg(canonical);
}

/** 按 event id 把 sq1 alg/scramble 收成 compact 短形以便显示;其它 event 原样返回。
 *  /alg 公式表 + /sim 打乱框 + /scramble/gen?mode=batch 自练 sheet 等处共用,保持
 *  视觉一致(全站默认简写)。 */
export function formatScrambleForEvent(event: string, scramble: string): string {
  return event === 'sq1' ? compactSq1Alg(scramble) : scramble;
}

/** /scramble/gen 专用:用户可在「简写 / 完整」间切。compact=true → 简写(全站默认),
 *  false → WCA 官方 (x, y) / 形式(打乱纸常用)。非 sq1 原样返回。 */
export function displaySq1ForEvent(event: string, scramble: string, compact: boolean): string {
  if (event !== 'sq1') return scramble;
  return compact ? compactSq1Alg(scramble) : canonicalSq1Alg(scramble);
}

export interface Sq1State {
  sliceSolved: boolean;
  pieces: number[];
}

/**
 * 24-position piece array (12 top + 12 bottom). Pieces are stored at the
 * 30° wedge positions; corner pieces occupy 2 consecutive slots with the
 * same id (60° span). Solved id range: top 0..7, bottom 8..15.
 */
const SOLVED_PIECES: number[] = [
  0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7,
  8, 9, 9, 10, 11, 11, 12, 13, 13, 14, 15, 15,
];

/** Parse + apply a WCA-spec sq1 scramble. Accepts every form parseSq1Tokens does. */
export function applySq1Scramble(scramble: string): Sq1State {
  let pieces = SOLVED_PIECES.slice();
  let sliceSolved = true;
  for (const tok of parseSq1Tokens(scramble)) {
    if (tok.kind === 'slice') {
      const next = pieces.slice();
      // Swap [6..11] with [12..17] — same as tnoodle doSlash().
      for (let i = 0; i < 6; i++) {
        const c = next[i + 12];
        next[i + 12] = next[i + 6];
        next[i + 6] = c;
      }
      pieces = next;
      sliceSolved = !sliceSolved;
    } else {
      const t = ((-tok.top % 12) + 12) % 12;
      const b = ((-tok.bot % 12) + 12) % 12;
      const next = pieces.slice();
      const oldTop = pieces.slice(0, 12);
      for (let i = 0; i < 12; i++) next[i] = oldTop[(t + i) % 12];
      const oldBot = pieces.slice(12, 24);
      for (let i = 0; i < 12; i++) next[i + 12] = oldBot[(b + i) % 12];
      pieces = next;
    }
  }
  return { pieces, sliceSolved };
}
