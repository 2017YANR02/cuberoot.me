/** Library notation is evidence, never permission to change the recorded transform. */
import { Alg, Grouping, Move } from 'cubing/alg';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { loadAlg, type AlgEntry, type AlgFile } from '../../alg';
import { cubeOnly, toMoveStringStrict } from '../../alg_notation';
import { getCube3 } from '../../recon/cube3';
import { ollCommentName, pllCommentName, primaryCaseName, zbllCommentLabel } from '../../recon/alg_case_display';
import { outerTurnSequence } from '../../recon_ground_truth';
import { compactCubeRotations } from './gyro_orient';
import { formatReconLine, type ReconTextLine, type ReconTextResult } from './recon_text';
import type { RangeMoveItem } from './step_metrics';

export interface NotationGroup { from: number; to: number }
interface Formula { moves: string[]; groups: NotationGroup[] }
interface Block { from: number; to: number; targetFrom: number; targetTo: number }
interface Match extends Formula { blocks: Block[]; source: string; implicitAuf: { before: string; after: string } }
const MAX_MOVES = 100;
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
  visit(new Alg(cubeOnly(text).replace(/\(/g, ' (').replace(/([URFDLBMESxyzurfdlb]w?(?:\d+)?'?)/g, ' $1 ')));
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

/** Exact normal form in the initial frame: only same-axis commutation/cancellation. */
export function strictOuterForm(moves: string[]): { key: string; rotation: string[] } {
  const tokens = moves.flatMap(token => {
    const move = new Move(token);
    if (!/^(?:[URFDLB]w?|[urfdlbMESxyz])$/.test(move.family)) throw new Error('Unsupported move');
    const amount = ((move.amount % 4) + 4) % 4;
    return amount ? [move.modified({ amount: amount === 3 ? -1 : amount }).toString()] : [];
  });
  const expanded = outerTurnSequence(tokens);
  const axes = ['UD', 'LR', 'FB'];
  const blocks: Array<{ axis: string; counts: number[] }> = [];
  for (const token of expanded.moves) {
    const move = new Move(token), axis = axes.find(axis => axis.includes(move.family))!;
    if (blocks.at(-1)?.axis !== axis) blocks.push({ axis, counts: [0, 0] });
    const block = blocks.at(-1)!, side = axis.indexOf(move.family);
    block.counts[side] = (block.counts[side] + move.amount + 4) % 4;
    if (block.counts.every(count => count === 0)) blocks.pop();
  }
  const key = blocks.flatMap(block => block.counts.flatMap((amount, index) => amount
    ? [block.axis[index] + (amount === 2 ? '2' : amount === 3 ? "'" : '')] : [])).join(' ');
  return { key, rotation: expanded.rotation };
}
const formulaCache = new Map<string, Formula | null>();
function cachedFormula(text: string): Formula | null {
  if (!formulaCache.has(text)) {
    if (formulaCache.size >= 4096) formulaCache.clear();
    try { formulaCache.set(text, parseFormula(text)); } catch { formulaCache.set(text, null); }
  }
  return formulaCache.get(text)!;
}

function matchBody(kp: KPuzzle, moves: string[], candidates: AlgEntry[]): Match | null {
  const before = states(kp, moves), sourceForm = strictOuterForm(moves);
  let preferred: Match | null = null;
  for (const entry of candidates) {
    const parsed = cachedFormula(entry.alg);
    if (!parsed) continue;
    // Keep library rotations: they define how its face names are interpreted.
    let from = 0, to = parsed.moves.length;
    while (from < to && /^U(?:\d+)?'?$/.test(parsed.moves[from])) from++;
    while (to > from && /^U(?:\d+)?'?$/.test(parsed.moves[to - 1])) to--;
    const body = parsed.moves.slice(from, to);
    if (!body.length) continue;
    for (const rotation of ['', 'y', 'y2', "y'"]) {
      const wrapper = rotation ? [rotation] : [];
      const inverse = rotation ? new Alg(rotation).invert().toString() : '';
      for (const pre of ['', 'U', 'U2', "U'"]) for (const post of ['', 'U', 'U2', "U'"]) {
        const offset = (pre ? 1 : 0) + wrapper.length;
        const tokens = [...(pre ? [pre] : []), ...wrapper, ...body,
          ...(inverse ? [inverse] : []), ...(post ? [post] : [])];
        let targetForm: ReturnType<typeof strictOuterForm>;
        try { targetForm = strictOuterForm(tokens); } catch { continue; }
        if (targetForm.key !== sourceForm.key) continue;
        // Preserve the recording's final frame, including a missing written regrip.
        const suffix = compactCubeRotations([
          new Alg(targetForm.rotation.join(' ')).invert().toString(), ...sourceForm.rotation,
        ].filter(Boolean).join(' ')).split(/\s+/).filter(Boolean);
        const trailing: string[] = [];
        while (tokens.length && /^[xyz]/.test(tokens.at(-1)!)) trailing.unshift(tokens.pop()!);
        tokens.push(...compactCubeRotations([...trailing, ...suffix].join(' ')).split(/\s+/).filter(Boolean));
        const blocks = align(before, states(kp, tokens));
        if (!blocks) continue; // Independent full cubie/centre equivalence check.
        const match: Match = { moves: tokens, source: entry.alg, blocks,
          implicitAuf: { before: pre, after: post },
          groups: parsed.groups.filter(group => group.from >= from && group.to <= to)
            .map(group => ({ from: group.from - from + offset, to: Math.min(group.to - from + offset, tokens.length) }))
            .filter(group => group.to > group.from),
        };
        if (!rotation) return match;
        preferred ??= match;
      }
    }
  }
  return preferred;
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
            token, ts, endTs,
            // The complete encoder span belongs to the final replacement step.
            startIdx, endIdx: index === target.length - 1 ? endIdx : startIdx - 1, seekEndIdx: endIdx,
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
      if (moves.join(' ') === line.moves.join(' ') && !matched.groups.length) return line;
      return { ...line, moves, moveRanges: ranges, wasteGroups,
        algorithmGroups: matched.groups.map(group => ({ from: positions[group.from], to: positions[group.to] })),
        libraryCorrection: { algorithm: matched.source, originalMoves: line.moves, originalRanges: line.moveRanges,
          implicitAuf: matched.implicitAuf, originalLine: line },
      };
    }
  } catch { /* Parsing or incomplete correspondence: retain the recorded notation. */ }
  return line;
}

/** All recognized last-layer families share strict matching; library failures retain source. */
export async function correctReconFromLibrary(
  recon: ReconTextResult,
  load: (set: string) => Promise<AlgFile> = set => loadAlg('3x3', set),
): Promise<ReconTextResult> {
  const files = new Map<string, Promise<AlgFile | null>>();
  const lines: ReconTextLine[] = [];
  for (const line of recon.lines) {
    const label = /^(OLL\(CP\)|OLLCP|1LLL|ZBLL|COLL|EPLL|OLL|PLL|ELL|ZBLS|VLS|WV|SV)(?:[- ](.+?))?(?:\/PLL Skip)?$/.exec(line.label ?? '');
    if (!label) { lines.push(line); continue; }
    const set = label[1] === 'EPLL' ? 'pll' : label[1] === 'OLL(CP)' ? 'ollcp' : label[1].toLowerCase();
    if (!files.has(set)) files.set(set, boundedLoad(() => load(set)));
    const file = await files.get(set)!;
    const key = (text: string) => text.toLowerCase().replace(/\s+/g, '');
    const cases = file?.cases.filter(item => !label[2] || [item.name, item.meta?.ollcp,
      primaryCaseName('3x3', set, item),
      set === 'oll' ? ollCommentName(item.name) : set === 'pll' ? pllCommentName(item.name) : undefined,
      set === 'zbll' ? zbllCommentLabel(item.name)?.replace(/^ZBLL-/, '') : undefined,
    ].some(alias => alias && key(alias) === key(label[2])));
    lines.push(cases?.length ? await correctLibraryLine(line, cases.flatMap(item => item.algs.flat())) : line);
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
