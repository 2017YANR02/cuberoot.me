/** Library notation is evidence, never permission to change the recorded transform. */
import { Alg, Grouping, Move } from 'cubing/alg';
import type { KPattern, KPuzzle } from 'cubing/kpuzzle';
import { loadAlg, type AlgEntry, type AlgFile, type AlgCase } from '../../alg';
import { cubeOnly, toMoveStringStrict } from '../../alg_notation';
import { getCube3 } from '../../recon/cube3';
import { ollCommentName, pllCommentName, primaryCaseName, zbllCommentLabel, PLL_RENAME } from '../../recon/alg_case_display';
import { outerTurnSequence } from '../../recon_ground_truth';
import { compactCubeRotations, conjugateToken, facePermFor } from './gyro_orient';
import { CUBE_ORIENTATIONS } from '../cube-orientation';
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
  return { key: reduceOuterTurns(expanded.moves), rotation: expanded.rotation };
}

/** Reduce outer turns only; callers have already resolved slices and rotations. */
function reduceOuterTurns(moves: string[]): string {
  const axes = ['UD', 'LR', 'FB'];
  const blocks: Array<{ axis: string; counts: number[] }> = [];
  for (const token of moves) {
    const family = token[0], amount = token.endsWith('2') ? 2 : token.endsWith("'") ? 3 : 1;
    const axis = axes.find(axis => axis.includes(family))!;
    if (blocks.at(-1)?.axis !== axis) blocks.push({ axis, counts: [0, 0] });
    const block = blocks.at(-1)!, side = axis.indexOf(family);
    block.counts[side] = (block.counts[side] + amount) % 4;
    if (block.counts.every(count => count === 0)) blocks.pop();
  }
  const key = blocks.flatMap(block => block.counts.flatMap((amount, index) => amount
    ? [block.axis[index] + (amount === 2 ? '2' : amount === 3 ? "'" : '')] : [])).join(' ');
  return key;
}
const formulaCache = new Map<string, Formula | null>();
function cachedFormula(text: string): Formula | null {
  if (!formulaCache.has(text)) {
    if (formulaCache.size >= 16384) formulaCache.delete(formulaCache.keys().next().value!);
    try { formulaCache.set(text, parseFormula(text)); } catch { formulaCache.set(text, null); }
  }
  return formulaCache.get(text)!;
}

// Adding AUF at either boundary can only add one outer face turn after
// rotation normalization. This superset admits every frame (including tilted
// U and slice-induced final rotations), but never authorizes a correction.
function possibleBodyKeys(sourceKey: string): Set<string> {
  const turns = ['', ...'URFDLB'.split('').flatMap(face => [face, `${face}2`, `${face}'`])];
  const source = sourceKey.split(' ').filter(Boolean);
  return new Set(turns.flatMap(pre => turns.map(post => reduceOuterTurns([
    ...(pre ? [pre] : []), ...source, ...(post ? [post] : []),
  ]))));
}
const bodyKeyCache = new Map<string, string>();
function cachedBodyKey(tokens: string[]): string {
  const text = tokens.join(' ');
  let key = bodyKeyCache.get(text);
  if (key === undefined) {
    key = strictOuterForm(tokens).key;
    if (bodyKeyCache.size >= 4096) bodyKeyCache.delete(bodyKeyCache.keys().next().value!);
    bodyKeyCache.set(text, key);
  }
  return key;
}
// Yield by elapsed work, not candidate count: nested browser timers otherwise
// add seconds even when the candidates are rejected almost immediately.
function timeSlice() {
  let since = performance.now();
  return async () => {
    if (performance.now() - since < 12) return;
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    since = performance.now();
  };
}

const matchingFrames = CUBE_ORIENTATIONS.map(({ value: rotation }) => {
  const inverse = rotation ? new Alg(rotation).invert().toString() : '';
  return { rotation, wrapper: rotation.split(/\s+/).filter(Boolean), inverse,
    tilted: /[xz]/.test(rotation), perm: facePermFor(inverse) };
});

async function matchBody(kp: KPuzzle, moves: string[], candidates: AlgEntry[], preserveMoves = false): Promise<Match | null> {
  const before = states(kp, moves), sourceForm = strictOuterForm(moves);
  const spelling = (token: string) => {
    const move = new Move(token.replace(/^([urfdlb])/, face => `${face.toUpperCase()}w`));
    return `${move.family}:${(move.amount % 4 + 4) % 4}`;
  };
  const spellings = preserveMoves ? moves.map(spelling) : [];
  let preferred: Match | null = null;
  const possibleKeys = possibleBodyKeys(sourceForm.key);
  const yieldIfNeeded = timeSlice();
  for (const entry of candidates) {
    await yieldIfNeeded();
    const parsed = cachedFormula(entry.alg);
    if (!parsed) continue;
    // Keep library rotations: they define how its face names are interpreted.
    let from = 0, to = parsed.moves.length;
    while (from < to && /^U(?:\d+)?'?$/.test(parsed.moves[from])) from++;
    while (to > from && /^U(?:\d+)?'?$/.test(parsed.moves[to - 1])) to--;
    let body = parsed.moves.slice(from, to);
    if (!body.length) continue;
    // Closed wide triggers can have exactly the recorded outer-turn path:
    // f' L f = B' U B, for example. Recognize that library spelling without
    // replacing encoder turns or introducing its optional boundary AUF.
    // Keep measured regrips/wide turns strict, and preserve group indices by
    // requiring one outer turn per library token and no residual rotation.
    if (preserveMoves && moves.every(token => /^[URFDLB](?:\d+)?'?$/.test(token))) {
      let end = body.length;
      while (end && /^[xyz]/.test(body[end - 1])) end--;
      const trigger = body.slice(0, end);
      if (trigger.every(token => /^(?:[URFDLB]w?|[urfdlb])(?:\d+)?'?$/.test(token))) {
        const outer = outerTurnSequence(trigger);
        if (outer.moves.length === trigger.length && !compactCubeRotations(outer.rotation.join(' '))) {
          // The existing matcher handles library-only final regrips separately.
          body = [...outer.moves, ...body.slice(end)];
        }
      }
    }
    // The recorded stage can still have its last layer on B/F/L/R/D;
    // cross-down presentation is applied later. Match in that actual frame.
    for (const { rotation, wrapper, inverse, tilted, perm } of matchingFrames) {
      const mappedBody = tilted ? body.map(token => conjugateToken(
        token.replace(/^([urfdlb])/, face => `${face.toUpperCase()}w`), perm,
      )) : body;
      if (mappedBody.some(token => token === null)) continue;
      if (preserveMoves) {
        // AUF/wrapper rotations never interrupt the library body. Even when
        // its trailing regrip is omitted, every remaining token must occur
        // contiguously in the measured path; spelling is the same as below.
        let end = mappedBody.length;
        while (end && /^[xyz]/.test(mappedBody[end - 1]!)) end--;
        const required = (mappedBody.slice(0, end) as string[]).map(spelling);
        if (required.length > spellings.length || !spellings.some((_, start) =>
          start + required.length <= spellings.length
          && required.every((token, i) => token === spellings[start + i]))) continue;
      }
      const orientedBody = tilted ? mappedBody : [...wrapper, ...body, ...inverse.split(/\s+/).filter(Boolean)];
      if (orientedBody.some(token => token === null)
        || !possibleKeys.has(cachedBodyKey(orientedBody as string[]))) continue;
      for (const pre of ['', 'U', 'U2', "U'"]) for (const post of ['', 'U', 'U2', "U'"]) {
        const offset = (pre ? 1 : 0) + (tilted ? 0 : wrapper.length);
        // AUF belongs to the library's U face, inside the frame conjugation.
        const framed = [...(pre ? [pre] : []), ...body, ...(post ? [post] : [])];
        // Tilted stages are normalized to cross-down later. Express the formula
        // in the recorded frame rather than inventing an x/z regrip around it.
        const mapped = tilted ? framed.map(token => conjugateToken(
          token.replace(/^([urfdlb])/, face => `${face.toUpperCase()}w`), perm,
        )) : framed;
        if (mapped.some(token => token === null)) continue;
        const tokens: string[] = tilted ? mapped as string[]
          : [...wrapper, ...framed, ...inverse.split(/\s+/).filter(Boolean)];
        if (preserveMoves) {
          // The suffix below may remove library-only final rotations, but cannot
          // change the body. Reject different fingertricks before cubie replay.
          let end = tokens.length;
          while (end && /^[xyz]/.test(tokens[end - 1])) end--;
          if (end !== moves.length || tokens.slice(0, end).some((token, i) => spelling(token) !== spellings[i])) continue;
        }
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
        // F2L already retains the measured wide turns. A matching case/formula
        // must not introduce a different fingertrick (e.g. y' U' -> d' ... y2).
        // Accept spelling differences such as Rw/r or R2'/R2, retaining the
        // recording's tokens and intermediate states rather than replacing them.
        if (preserveMoves) {
          if (tokens.length !== moves.length || tokens.some((token, i) => spelling(token) !== spellings[i])) continue;
          tokens.splice(0, tokens.length, ...moves);
        }
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
export async function correctLibraryLine(line: ReconTextLine, candidates: AlgEntry[], preserveMoves = false): Promise<ReconTextLine> {
  if (line.libraryCorrection || !line.moveRanges || line.moves.length !== line.moveRanges.length
    || !line.moves.length || line.moves.length > MAX_MOVES) return line;
  const originalCoverage = coverage(line.moveRanges);
  if (originalCoverage === null) return line;
  const kp = await getCube3();
  const bounds = [bodyBounds(line.moves, line.wasteGroups)];
  // Raw U may be a side turn when the top layer is tilted. If the usual AUF
  // trimming cannot match, retry with those face turns inside the formula.
  let fullFrom = 0, fullTo = line.moves.length;
  while (fullFrom < fullTo && /^[xyz]/.test(line.moves[fullFrom])) fullFrom++;
  while (fullTo > fullFrom && /^[xyz]/.test(line.moves[fullTo - 1])) fullTo--;
  if (bounds[0][0] !== fullFrom || bounds[0][1] !== fullTo) bounds.push([fullFrom, fullTo]);
  for (const [from, to] of bounds) {
    const body = line.moves.slice(from, to);
    if (!body.length) continue;
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
        // Waste brackets can include a useful net turn, e.g. (R R' R).
        // Extract only closed subpaths, retaining the final R in the formula.
        const path = states(kp, indices.map(index => line.moves[index]));
        for (let start = 0; start < indices.length;) {
          let end = indices.length;
          while (end > start && path[end] !== path[start]) end--;
          if (end > start) { waste.push(indices.slice(start, end)); start = end; }
          else start++;
        }
      }
      if (waste.length) {
        const removed = new Set(waste.flat());
        variants.push({ kept: variants[0].kept.filter(index => !removed.has(index)), waste });
      }
      for (const variant of variants) {
        if (!variant.kept.length) continue;
        const matched = await matchBody(kp, variant.kept.map(index => line.moves[index]), candidates, preserveMoves);
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
        // Retain proof of a library match even when its notation is unchanged:
        // F2L display must preserve library wide turns and expand ordinary ones.
        return { ...line, moves, moveRanges: ranges, wasteGroups,
          algorithmGroups: matched.groups.map(group => ({ from: positions[group.from], to: positions[group.to] })),
          libraryCorrection: { algorithm: matched.source, originalMoves: line.moves, originalRanges: line.moveRanges,
            implicitAuf: matched.implicitAuf, originalLine: line },
        };
      }
    } catch { /* Parsing or incomplete correspondence: retain the recorded notation. */ }
  }
  return line;
}

const fingerprintCache = new Map<string, string>();

/** All recognized last-layer families share strict matching; library failures retain source. */
export async function identifyLibraryCase(line: Pick<ReconTextLine, 'moves'>, cases: AlgCase[], set: string): Promise<AlgCase | undefined> {
  const kp = await getCube3();
  const key = (tokens: string[]) => {
    const outer = strictOuterForm(tokens).key;
    const { CORNERS, EDGES } = kp.defaultPattern().applyAlg(new Alg(outer).invert()).patternData;
    if (set === 'coll') return JSON.stringify(CORNERS);
    if (set === 'ollcp') return JSON.stringify([CORNERS, EDGES.orientation]);
    if (set === 'oll') return JSON.stringify([CORNERS.orientation, EDGES.orientation]);
    if (set === 'ell') return JSON.stringify(EDGES);
    return JSON.stringify([CORNERS, EDGES]);
  };
  const parsed = cachedFormula(line.moves.join(' '));
  if (!parsed) return;
  const exactKey = key(parsed.moves);
  const keys = new Set<string>();
  for (const y of ['', 'y', 'y2', "y'"]) for (const pre of ['', 'U', 'U2', "U'"]) for (const post of ['', 'U', 'U2', "U'"]) {
    keys.add(key([pre, y, ...parsed.moves, y ? new Alg(y).invert().toString() : '', post].filter(Boolean)));
  }
  const exact = new Set<AlgCase>();
  const equivalent = new Set<AlgCase>();
  const yieldIfNeeded = timeSlice();
  for (const item of cases) {
    await yieldIfNeeded();
    for (const entry of item.algs.flat()) {
      const formula = cachedFormula(entry.alg);
      if (!formula) continue;
      try {
        const cacheKey = `${set}:${entry.alg}`;
        let fingerprint = fingerprintCache.get(cacheKey);
        if (fingerprint === undefined) {
          fingerprint = key(formula.moves);
          if (fingerprintCache.size >= 16384) fingerprintCache.delete(fingerprintCache.keys().next().value!);
          fingerprintCache.set(cacheKey, fingerprint);
        }
        if (fingerprint === exactKey) exact.add(item);
        if (keys.has(fingerprint)) equivalent.add(item);
      } catch { /* Unsupported library entries cannot identify a case. */ }
    }
  }
  // Preserve the recorded case orientation before considering AUF/y variants.
  // Some libraries intentionally list those variants as separate cases.
  if (exact.size === 1) return [...exact][0];
  if (exact.size > 1) return;
  return equivalent.size === 1 ? [...equivalent][0] : undefined;
}

export async function correctReconFromLibrary(
  recon: ReconTextResult,
  load: (set: string) => Promise<AlgFile> = set => loadAlg('3x3', set),
  confirmedEnd = -1,
): Promise<ReconTextResult> {
  const files = new Map<string, Promise<AlgFile | null>>();
  const lineLabel = (line: ReconTextLine) => /^(?:([WYGBOR]{2})\/?\s*)?(OLL\(CP\)|OLLCP|1LLL|ZBLL|COLL|EPLL|OLL|PLL|ELL|ZBLS|VLS|WV|SV)(?:[- ](.+?))?(\/PLL Skip)?$/.exec(line.label ?? '');
  const librarySet = (label: string) => label === 'EPLL' ? 'pll' : label === 'OLL(CP)' ? 'ollcp' : label.toLowerCase();
  // Start independent set requests together; four F2L lines share one request.
  for (const line of recon.lines) {
    if (line.toIdx <= confirmedEnd) continue;
    const label = lineLabel(line);
    const set = label ? librarySet(label[2]) : line.kind === 'f2l' ? 'f2l' : null;
    if (set && !files.has(set)) files.set(set, boundedLoad(() => load(set)));
  }
  const lines: ReconTextLine[] = [];
  for (const line of recon.lines) {
    if (line.toIdx <= confirmedEnd) { lines.push(line); continue; }
    const label = lineLabel(line);
    // F2L case links identify a starting state; preserving the executed formula
    // requires the same strict move-path match used for last-layer algorithms.
    // Keep pair labels unchanged and never substitute another solution to a case.
    if (line.kind === 'f2l' && !label) {
      if (!files.has('f2l')) files.set('f2l', boundedLoad(() => load('f2l')));
      const file = await files.get('f2l')!;
      lines.push(file ? await correctLibraryLine(line, file.cases.flatMap(item => item.algs.flat()), true) : line);
      continue;
    }
    if (!label) { lines.push(line); continue; }
    const colors = label.splice(1, 1)[0];
    const set = librarySet(label[1]);
    if (!files.has(set)) files.set(set, boundedLoad(() => load(set)));
    const file = await files.get(set)!;
    const key = (text: string) => text.toLowerCase().replace(/\s+/g, '');
    const cases = file?.cases.filter(item => !label[2] || [item.name, item.meta?.ollcp,
      primaryCaseName('3x3', set, item),
      set === 'oll' ? ollCommentName(item.name) : set === 'pll' ? pllCommentName(item.name) : undefined,
      set === 'zbll' ? zbllCommentLabel(item.name)?.replace(/^ZBLL-/, '') : undefined,
    ].some(alias => alias && (key(alias) === key(label[2])
      || (set === 'pll' && key(alias) === key(pllCommentName(label[2]))))));
    // A unique case fingerprint is a necessary condition for an exact full
    // transformation match. Narrow before enumerating 64 AUF/y variants per
    // formula; retain the old candidate order whenever recognition is ambiguous.
    const identified = !label[2] && cases?.length ? await identifyLibraryCase(line, cases, set).catch(() => undefined) : undefined;
    const candidates = identified ? [identified] : cases;
    // Named last-slot cases remain F2L. Preserve measured wide-turn gestures
    // just as for ordinary pairs instead of substituting a library fingertrick.
    const preserveWide = line.kind === 'f2l'
      && line.moves.some(move => /^(?:[rludfb]|[RLUDFB]w)(?:2'?|')?$/.test(move));
    let corrected = candidates?.length ? await correctLibraryLine(line, candidates.flatMap(item => item.algs.flat()), preserveWide) : line;
    // A last-slot formula is still F2L: recognizing its library name must not
    // move a recorded regrip across layer turns (for example y' R' -> F' y').
    // Retain the match proof, but use the original path and encoder timing.
    if (line.kind === 'f2l' && corrected.libraryCorrection
      && line.moves.some((token, i) => /^[xyz]/.test(token)
        && line.moves.slice(0, i).some(move => !/^[xyz]/.test(move))
        && line.moves.slice(i + 1).some(move => !/^[xyz]/.test(move)))) {
      corrected = { ...line, libraryCorrection: corrected.libraryCorrection };
    }
    // Names are independent of whether the recorded fingertrick matches a
    // library algorithm. Use the same primary name as the /alg case list.
    let namedCases = label[2] ? cases : cases?.filter(item => corrected.libraryCorrection
      && item.algs.flat().some(alg => alg.alg === corrected.libraryCorrection!.algorithm));
    if (!label[2] && namedCases?.length !== 1 && cases?.length) {
      if (identified) namedCases = [identified];
    }
    if (namedCases?.length === 1) {
      // List titles may include a legacy case number; reconstruction needs
      // only the library name, not that parenthesized secondary identifier.
      const primary = primaryCaseName('3x3', set, namedCases[0]).replace(/\s+\(([^()]*)\)$/,
        (suffix, identifier: string) => /^\d+$/.test(identifier) || Object.hasOwn(PLL_RENAME, identifier) ? '' : suffix);
      const name = `${colors ? `${colors}/` : ''}${label[1]}-${primary}${label[3] ?? ''}`;
      if (corrected.label !== name) corrected = { ...corrected, label: name };
    }
    lines.push(corrected);
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
      // Large sets such as ZBLL can take several seconds through the API proxy.
      // The original reconstruction is already visible while this runs.
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 15000); })]);
  } finally { clearTimeout(timer); }
}
