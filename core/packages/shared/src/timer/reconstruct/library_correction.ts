/** Library notation is evidence, never permission to change the recorded transform. */
import { Alg, Grouping, Move } from 'cubing/alg';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { loadAlg, type AlgEntry, type AlgFile } from '../../alg';
import { cubeOnly, toMoveStringStrict } from '../../alg_notation';
import { getCube3 } from '../../recon/cube3';
import { ollCommentName, pllCommentName } from '../../recon/alg_case_display';
import { conjugateToken, facePermFor } from './orient';
import { formatReconLine, type ReconTextLine, type ReconTextResult } from './recon_text';
import type { RangeMoveItem } from './step_metrics';

export interface NotationGroup { from: number; to: number }
interface Formula { moves: string[]; groups: NotationGroup[] }
interface Block { from: number; to: number; targetFrom: number; targetTo: number }
interface Match extends Formula { blocks: Block[]; score: number; source: string; implicitAuf: { before: string; after: string } }
const MAX_MOVES = 100;
const MIN_OVERLAP = 0.6;
const UNIQUE_MARGIN = 0.08;
const boundary = (token: string) => /^(?:U|[xyz])(?:\d+)?'?$/.test(token);

/** Expand execution repeats while retaining grouping, without simplifying R3 or R2'. */
function parseFormula(text: string): Formula {
  const moves: string[] = [], groups: NotationGroup[] = [];
  const visit = (alg: Alg) => {
    for (const node of alg.childAlgNodes()) {
      if (node instanceof Move) moves.push(node.toString());
      else if (node instanceof Grouping) {
        if (Math.abs(node.amount) > MAX_MOVES) throw new Error('Unbounded formula');
        for (let i = 0; i < Math.abs(node.amount); i++) {
          const from = moves.length;
          visit(node.amount < 0 ? node.alg.invert() : node.alg);
          if (moves.length > from) groups.push({ from, to: moves.length });
        }
      } else throw new Error('Unsupported library notation');
      if (moves.length > MAX_MOVES) throw new Error('Long formula');
    }
  };
  visit(new Alg(cubeOnly(text)));
  // The shared strict tokenizer also guards unknown/glued move families.
  if (moves.join(' ') !== toMoveStringStrict(text)) throw new Error('Noncanonical formula');
  return { moves, groups };
}

function bodyBounds(moves: string[], waste?: Array<number | null>): [number, number] {
  // Boundary AUF remains outside the formula even when redundant turns are
  // marked as waste. Never split a waste group extending into the body.
  const isBoundary = (index: number) => {
    if (!boundary(moves[index])) return false;
    const group = waste?.[index];
    return group == null || moves.every((move, i) => waste?.[i] !== group || /^U(?:\d+)?'?$/.test(move));
  };
  let from = 0, to = moves.length;
  while (from < to && isBoundary(from)) from++;
  while (to > from && isBoundary(to - 1)) to--;
  return [from, to];
}

/** Ordinary 3x3 centres have no picture orientation. Their positions still matter. */
function stateKey(pattern: KPattern): string {
  const { EDGES, CORNERS, CENTERS } = pattern.patternData;
  return JSON.stringify([EDGES, CORNERS, CENTERS.pieces]);
}
function states(kp: KPuzzle, moves: string[]): string[] {
  let state = kp.defaultPattern();
  return [stateKey(state), ...moves.map(move => {
    state = state.applyMove(move);
    return stateKey(state);
  })];
}

function overlap(a: string[], b: string[]): number {
  const rows = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = a[i - 1] === b[j - 1] ? rows[i - 1][j - 1] + 1 : Math.max(rows[i - 1][j], rows[i][j - 1]);
  }
  return 2 * rows[a.length][b.length] / (a.length + b.length);
}

function coverage(ranges: RangeMoveItem[]): string | null {
  const covered = new Set<number>();
  for (const range of ranges) {
    if (!Number.isInteger(range.startIdx) || !Number.isInteger(range.endIdx)
      || !Number.isFinite(range.ts) || !Number.isFinite(range.endTs) || range.endTs < range.ts) return null;
    for (let i = range.startIdx; i <= range.endIdx; i++) {
      if (covered.has(i)) return null;
      covered.add(i);
    }
  }
  return [...covered].sort((a, b) => a - b).join(',');
}

/** Maximal monotone exact-state anchors, not a guess based on text similarity. */
function align(a: string[], b: string[]): Block[] | null {
  if (a.at(-1) !== b.at(-1)) return null;
  const n = a.length - 1, m = b.length - 1;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i > 0; i--) for (let j = m - 1; j > 0; j--) {
    dp[i][j] = a[i] === b[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const anchors = [[0, 0]];
  let i = 1, j = 1;
  while (i < n && j < m) {
    if (a[i] === b[j]) { anchors.push([i++, j++]); }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  anchors.push([n, m]);
  return anchors.slice(1).map(([to, targetTo], index) => ({
    from: anchors[index][0], targetFrom: anchors[index][1], to, targetTo,
  }));
}

function matchBody(kp: KPuzzle, moves: string[], candidates: AlgEntry[]): Match | null {
  const before = states(kp, moves);
  const matches = new Map<string, Match>();
  for (const entry of candidates) {
    let parsed: Formula;
    try { parsed = parseFormula(entry.alg); } catch { continue; }
    const [from, to] = bodyBounds(parsed.moves);
    const body = parsed.moves.slice(from, to);
    if (!body.length) continue;
    for (const rotation of ['', 'y', 'y2', "y'"]) {
      const perm = facePermFor(rotation);
      const target = body.map(token => {
        if (!rotation) return token;
        const move = new Move(token);
        const family = /^[rludfb]$/.test(move.family) ? `${move.family.toUpperCase()}w` : move.family;
        const mapped = conjugateToken(family, perm);
        if (!mapped) return null;
        const direction = new Move(mapped);
        return direction.modified({ amount: direction.amount * move.amount }).toString();
      });
      if (target.some(move => move === null)) continue;
      const bodyTokens = target as string[];
      // AUF may be encoded inside slice/wide notation instead of appearing as
      // a boundary U token. Infer it from the recorded transform, never copy it
      // from the library. Both outer wrappers are checked again before output.
      for (const pre of ['', 'U', 'U2', "U'"]) for (const post of ['', 'U', 'U2', "U'"]) {
        const offset = pre ? 1 : 0;
        const tokens = [...(pre ? [pre] : []), ...bodyTokens, ...(post ? [post] : [])];
        let blocks: Block[] | null;
        try { blocks = align(before, states(kp, tokens)); } catch { continue; }
        if (!blocks) continue;
        // A verified one-to-few decomposition (slice/wide/half turn) is also
        // execution evidence. A single whole-algorithm equivalence is not.
        const local = blocks.filter(block => Math.min(block.to - block.from, block.targetTo - block.targetFrom) === 1
          && Math.max(block.to - block.from, block.targetTo - block.targetFrom) <= 3
          && block.targetFrom >= offset && block.targetTo <= offset + bodyTokens.length);
        const supportedSource = local.reduce((sum, block) => sum + block.to - block.from, 0);
        const supportedTarget = local.reduce((sum, block) => sum + block.targetTo - block.targetFrom, 0);
        // Exclude recorded steps proven to be only boundary AUF from body scoring.
        const sourceBody = blocks.filter(block => block.targetTo > offset && block.targetFrom < offset + bodyTokens.length)
          .flatMap(block => moves.slice(block.from, block.to));
        const score = Math.max(overlap(sourceBody, bodyTokens), (supportedSource / sourceBody.length + supportedTarget / bodyTokens.length) / 2);
        if (score < MIN_OVERLAP) continue;
        const key = tokens.join(' ');
        if (matches.has(key)) continue; // Formatting/AUF duplicates are one candidate.
        matches.set(key, { moves: tokens, source: entry.alg, score, blocks, implicitAuf: { before: pre, after: post },
          groups: parsed.groups.filter(group => group.from >= from && group.to <= to)
            .map(group => ({ from: group.from - from + offset, to: group.to - from + offset })),
        });
      }
    }
  }
  const ranked = [...matches.values()].sort((a, b) => b.score - a.score);
  if (!ranked.length || ranked[1] && ranked[0].score - ranked[1].score < UNIQUE_MARGIN) return null;
  return ranked[0];
}

/** No input mutations, no change without complete transforms and replay coverage. */
export async function correctLibraryLine(line: ReconTextLine, candidates: AlgEntry[]): Promise<ReconTextLine> {
  if (line.libraryCorrection || !line.moveRanges || line.moves.length !== line.moveRanges.length
    || !line.moves.length || line.moves.length > MAX_MOVES) return line;
  const originalCoverage = coverage(line.moveRanges);
  if (originalCoverage === null) return line;
  const kp = await getCube3();
  const [from, to] = bodyBounds(line.moves, line.wasteGroups);
  const body = line.moves.slice(from, to);
  if (!body.length) return line;
  try {
    // Keep physical waste on the full path whenever the library contains it too.
    // Only remove verified identity loops for the second matching attempt.
    const variants: Array<{ kept: number[]; waste: number[][] }> = [{ kept: body.map((_, i) => i + from), waste: [] }];
    const waste: number[][] = [];
    for (let i = from; i < to;) {
      const group = line.wasteGroups?.[i];
      if (group == null) { i++; continue; }
      const indices: number[] = [];
      while (i < to && line.wasteGroups?.[i] === group) indices.push(i++);
      if (states(kp, indices.map(index => line.moves[index])).at(-1) !== stateKey(kp.defaultPattern())) return line;
      waste.push(indices);
    }
    if (waste.length) {
      const removed = new Set(waste.flat());
      variants.push({ kept: variants[0].kept.filter(index => !removed.has(index)), waste });
    }
    for (const variant of variants) {
      if (!variant.kept.length) continue;
      const matched = matchBody(kp, variant.kept.map(index => line.moves[index]), candidates);
      if (!matched) continue;
      const items: RangeMoveItem[] = [], groups: Array<number | null> = [];
      const inserts = new Map<number, number[]>();
      let safe = true;
      for (const indices of variant.waste) {
        const sourceBoundary = variant.kept.filter(index => index < indices[0]).length;
        const anchor = sourceBoundary === 0 ? 0 : matched.blocks.find(block => block.to === sourceBoundary)?.targetTo;
        if (anchor === undefined) { safe = false; break; }
        inserts.set(anchor, [...(inserts.get(anchor) ?? []), ...indices]);
      }
      if (!safe) continue;
      for (const block of matched.blocks) {
        const originals = variant.kept.slice(block.from, block.to);
        const source = originals.map(index => line.moves[index]);
        const target = matched.moves.slice(block.targetFrom, block.targetTo);
        const same = source.join(' ') === target.join(' ');
        // Never move a waste loop through a changed intermediate state.
        if (!same && originals.some(index => line.wasteGroups?.[index] != null)) { safe = false; break; }
        const ranges = originals.map(index => line.moveRanges![index]);
        const startIdx = Math.min(...ranges.map(range => range.startIdx));
        const endIdx = Math.max(...ranges.map(range => range.endIdx));
        const ts = Math.min(...ranges.map(range => range.ts));
        const endTs = Math.max(...ranges.map(range => range.endTs));
        target.forEach((token, index) => {
          items.push(same ? { ...ranges[index], token } : {
            token, ts: ts + (endTs - ts) * index / target.length,
            endTs: ts + (endTs - ts) * (index + 1) / target.length,
            // The complete encoder span belongs to the final replacement step.
            startIdx, endIdx: index === target.length - 1 ? endIdx : startIdx - 1,
          });
          groups.push(same ? line.wasteGroups?.[originals[index]] ?? null : null);
        });
      }
      if (!safe) continue;
      const ranges = line.moveRanges.slice(0, from);
      const wasteGroups = line.moves.slice(0, from).map((_, index) => line.wasteGroups?.[index] ?? null);
      const positions: number[] = [];
      for (let i = 0; i <= items.length; i++) {
        for (const index of inserts.get(i) ?? []) { ranges.push(line.moveRanges[index]); wasteGroups.push(line.wasteGroups?.[index] ?? null); }
        positions.push(ranges.length);
        if (i < items.length) { ranges.push(items[i]); wasteGroups.push(groups[i]); }
      }
      ranges.push(...line.moveRanges.slice(to));
      wasteGroups.push(...line.moves.slice(to).map((_, i) => line.wasteGroups?.[to + i] ?? null));
      const moves = ranges.map(range => range.token);
      if (coverage(ranges) !== originalCoverage) continue;
      // Also verifies the unchanged AUF/inspection/waste wrappers as a whole.
      if (states(kp, moves).at(-1) !== states(kp, line.moves).at(-1)) continue;
      if (moves.join(' ') === line.moves.join(' ')) return line;
      return { ...line, moves, moveRanges: ranges, wasteGroups,
        algorithmGroups: matched.groups.map(group => ({ from: positions[group.from], to: positions[group.to] })),
        libraryCorrection: { algorithm: matched.source, originalMoves: line.moves, originalRanges: line.moveRanges,
          implicitAuf: matched.implicitAuf },
      };
    }
  } catch { /* Parsing or incomplete correspondence: retain the recorded notation. */ }
  return line;
}

/** Exact recognized OLL/PLL cases only. A library failure never hides the report. */
export async function correctReconFromLibrary(
  recon: ReconTextResult,
  load: (set: string) => Promise<AlgFile> = set => loadAlg('3x3', set),
): Promise<ReconTextResult> {
  const files = new Map<string, Promise<AlgFile | null>>();
  const lines: ReconTextLine[] = [];
  for (const line of recon.lines) {
    const label = /^(OLL|PLL|EPLL)-([A-Za-z0-9+-]+)(?:\/PLL Skip)?$/.exec(line.label ?? '');
    if (!label || (line.kind !== 'oll' && line.kind !== 'pll')) { lines.push(line); continue; }
    const set = label[1] === 'OLL' ? 'oll' : 'pll';
    if (!files.has(set)) files.set(set, boundedLoad(() => load(set)));
    const file = await files.get(set)!;
    const cases = file?.cases.filter(item => (set === 'oll' ? ollCommentName(item.name) : pllCommentName(item.name)) === label[2]);
    lines.push(cases?.length === 1 ? await correctLibraryLine(line, cases[0].algs.flat()) : line);
  }
  if (lines.every((line, i) => line === recon.lines[i])) return recon;
  return { ...recon, lines, text: [
    ...(recon.inspection ? [`${recon.inspection} // insp`] : []), ...lines.map(formatReconLine),
  ].join('\n') };
}

async function boundedLoad(load: () => Promise<AlgFile>): Promise<AlgFile | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve().then(load).catch(() => null),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 2500); })]);
  } finally { clearTimeout(timer); }
}
