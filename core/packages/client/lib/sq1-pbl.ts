import {
  applySq1Scramble,
  canonicalSq1Alg,
  parseSq1Tokens,
  simplifySq1Alg,
  type Sq1State,
  type Sq1Token,
} from '@cuberoot/shared/sq1-notation';
import { traceSq1Algorithm } from '@/lib/sq1-tools';

export type Sq1PblSearchMode = 'legacy' | 'strict';

export interface Sq1PblPll {
  name: string;
  parity: boolean;
  topSetup: string;
  bottomSetup: string;
}

export interface Sq1PblAuxiliary {
  name: string;
  sequence: string;
}

export interface Sq1PblFinderDefaults {
  schemaVersion: number;
  provenance: {
    application: string;
    authors: string[];
    sourceUrl: string;
    sourceSha256: string;
    auxiliaryDataCredit?: {
      name: string;
      description: string;
      sourceUrl: string;
    };
  };
  licenseStatus: {
    status: string;
    redistributionPermission: string;
    notice: string;
  };
  plls: {
    standard: Sq1PblPll[];
    parity: Sq1PblPll[];
  };
  auxiliaryAlgorithms: Sq1PblAuxiliary[];
}

export interface Sq1PblSearchInput {
  top: Sq1PblPll;
  bottom: Sq1PblPll;
  auxiliary: Sq1PblAuxiliary[];
  mode?: Sq1PblSearchMode;
}

export interface Sq1PblSolution {
  algorithm: string;
  compactAlgorithm: string;
  auxiliary: [string, string];
  stm: number;
  ftm: number;
}

export interface Sq1PblSearchResult {
  target: string;
  setup: string;
  candidateCount: number;
  solutions: Sq1PblSolution[];
}

export type Sq1PblAuxiliaryProblem =
  | { index: number; reason: 'empty-name' | 'empty-sequence' | 'invalid-notation' | 'unsliceable'; step?: number }
  | { index: number; reason: 'duplicate-name' | 'duplicate-sequence'; duplicateOf: number };

export type Sq1PblAuxiliaryParseResult =
  | { ok: true; value: Sq1PblAuxiliary }
  | { ok: false; reason: 'missing-separator' | 'empty-name' | 'empty-sequence' | 'invalid-notation' | 'unsliceable'; step?: number };

const SOLVED = applySq1Scramble('');

function isLegacySliceable(pieces: readonly number[]): boolean {
  return pieces[0] !== pieces[11]
    && pieces[5] !== pieces[6]
    && pieces[12] !== pieces[23]
    && pieces[17] !== pieces[18];
}

/**
 * The desktop Cube silently ignores a slash when the current shape cannot be
 * sliced. Keep that historical quirk inside legacy Finder mode; the site's
 * normal Square-1 state helpers intentionally assume legal WCA sequences.
 */
function applySq1PblTokens(
  initial: Sq1State,
  tokens: readonly Sq1Token[],
  mode: Sq1PblSearchMode,
): Sq1State {
  let pieces = initial.pieces.slice();
  let scratch = initial.pieces.slice();
  let sliceSolved = initial.sliceSolved;

  for (const token of tokens) {
    if (token.kind === 'slice') {
      if (mode === 'legacy' && !isLegacySliceable(pieces)) continue;
      for (let index = 0; index < 6; index += 1) {
        const swapped = pieces[index + 6];
        pieces[index + 6] = pieces[index + 12];
        pieces[index + 12] = swapped;
      }
      sliceSolved = !sliceSolved;
      continue;
    }

    const topOffset = ((-token.top % 12) + 12) % 12;
    const bottomOffset = ((-token.bot % 12) + 12) % 12;
    for (let index = 0; index < 12; index += 1) {
      scratch[index] = pieces[(topOffset + index) % 12];
      scratch[index + 12] = pieces[12 + ((bottomOffset + index) % 12)];
    }
    [pieces, scratch] = [scratch, pieces];
  }

  return { pieces, sliceSolved };
}

function layerCyclicallyMatches(
  actual: readonly number[],
  actualStart: number,
  expected: readonly number[],
  expectedStart: number,
): boolean {
  for (let offset = 0; offset < 12; offset += 1) {
    let matches = true;
    for (let index = 0; index < 12; index += 1) {
      if (actual[actualStart + index] !== expected[expectedStart + ((index + offset) % 12)]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

/** PBL is solved when each layer matches solved up to AUF. Strict mode also checks the middle layer. */
export function isSq1PblSolved(state: Sq1State, mode: Sq1PblSearchMode = 'legacy'): boolean {
  const topSolved = layerCyclicallyMatches(state.pieces, 0, SOLVED.pieces, 0);
  const bottomSolved = layerCyclicallyMatches(state.pieces, 12, SOLVED.pieces, 12);
  return topSolved && bottomSolved && (mode === 'legacy' || state.sliceSolved);
}

function parsedConcatenationIsComposable(first: string, second: string): boolean {
  return first.trimEnd().endsWith('/') || second.trimStart().startsWith('/');
}

function strictSequence(sequence: string): { ok: true; canonical: string } | { ok: false; reason: 'invalid-notation' | 'unsliceable'; step?: number } {
  const traced = traceSq1Algorithm(sequence);
  // Auxiliary strings are fragments joined to a selected PBL setup, so a
  // slash that is impossible from solved may be legal in its real context.
  // traceSq1Algorithm establishes strict token coverage before reporting that
  // contextual sliceability error; only malformed notation is rejected here.
  if (!traced.ok && traced.reason === 'invalid-notation') return traced;
  return { ok: true, canonical: canonicalSq1Alg(sequence) };
}

/** Parse the JAR's documented `name@sequence` input without inheriting its crash cases. */
export function parseSq1PblAuxiliaryInput(input: string): Sq1PblAuxiliaryParseResult {
  const separator = input.indexOf('@');
  if (separator < 0) return { ok: false, reason: 'missing-separator' };
  return normalizeSq1PblAuxiliary(input.slice(0, separator), input.slice(separator + 1));
}

/** Normalize imported or persisted fields to the compact syntax consumed by the legacy Finder. */
export function normalizeSq1PblAuxiliary(nameInput: string, sequenceInput: string): Sq1PblAuxiliaryParseResult {
  const name = nameInput.trim();
  const sequence = sequenceInput.trim();
  if (!name) return { ok: false, reason: 'empty-name' };
  if (!sequence) return { ok: false, reason: 'empty-sequence' };
  const checked = strictSequence(sequence);
  if (!checked.ok) return checked;
  return { ok: true, value: { name, sequence: compactForFinder(checked.canonical) } };
}

export function validateSq1PblAuxiliary(items: readonly Sq1PblAuxiliary[]): Sq1PblAuxiliaryProblem[] {
  const problems: Sq1PblAuxiliaryProblem[] = [];
  const names = new Map<string, number>();
  const sequences = new Map<string, number>();

  items.forEach((item, index) => {
    const name = item.name.trim();
    const sequence = item.sequence.trim();
    if (!name) problems.push({ index, reason: 'empty-name' });
    if (!sequence) {
      problems.push({ index, reason: 'empty-sequence' });
      return;
    }

    const checked = strictSequence(sequence);
    if (!checked.ok) {
      problems.push({ index, reason: checked.reason, step: checked.step });
      return;
    }

    const nameKey = name.toLocaleLowerCase('en-US');
    const duplicateName = names.get(nameKey);
    if (duplicateName !== undefined) problems.push({ index, reason: 'duplicate-name', duplicateOf: duplicateName });
    else names.set(nameKey, index);

    const sequenceKey = checked.canonical;
    const duplicateSequence = sequences.get(sequenceKey);
    if (duplicateSequence !== undefined) problems.push({ index, reason: 'duplicate-sequence', duplicateOf: duplicateSequence });
    else sequences.set(sequenceKey, index);
  });

  return problems;
}

export function sq1PblMetrics(algorithm: string): { stm: number; ftm: number } {
  const tokens = parseSq1Tokens(algorithm);
  const stm = tokens.filter((token) => token.kind === 'slice').length;
  const ftm = stm + tokens.reduce((count, token) =>
    token.kind === 'turn' ? count + Number(token.top !== 0) + Number(token.bot !== 0) : count, 0);
  return { stm, ftm };
}

function normalizeLegacyMergedTurn(value: number): number {
  if (value > 6) return value - 12;
  // This intentionally preserves the desktop app's historical sign error.
  if (value < -6) return 12 - value;
  return value;
}

function joinLegacySequence(parts: readonly string[], source: string): string {
  let joined = parts.map((part) => {
    const [top, bottom] = part.split(',');
    return `${Number.parseInt(top, 10)},${Number.parseInt(bottom, 10)}`;
  }).join('/');
  if (source.startsWith('/')) joined = `/${joined}`;
  if (source.endsWith('/') || source.endsWith('/0,0')) joined += '/';
  return joined;
}

/**
 * Clean-room behavioral match for the desktop finder's public
 * `CustomStringUtils.otimizedSequence` method. It intentionally retains the
 * legacy boundary-slash behavior and negative-turn wrap bug for result parity.
 */
export function legacyOptimizeSq1PblSequence(sequence: string): string {
  const parts = sequence.replaceAll(' ', '').split('/').filter(Boolean);
  const zeroIndex = parts.indexOf('0,0');

  if (zeroIndex < 0) return joinLegacySequence(parts, sequence);

  if (zeroIndex > 0 && zeroIndex < parts.length - 1) {
    const previous = parts[zeroIndex - 1].split(',').map(Number);
    const next = parts[zeroIndex + 1].split(',').map(Number);
    const mergedTop = normalizeLegacyMergedTurn(previous[0] + next[0]);
    const mergedBottom = normalizeLegacyMergedTurn(previous[1] + next[1]);
    const merged = `${mergedTop},${mergedBottom}`;
    parts.splice(zeroIndex - 1, 3, merged);
    return legacyOptimizeSq1PblSequence(joinLegacySequence(parts, sequence));
  }

  if (zeroIndex === 0) {
    parts.shift();
    return legacyOptimizeSq1PblSequence(joinLegacySequence(parts, sequence.replace('/', '')));
  }

  parts.pop();
  return legacyOptimizeSq1PblSequence(joinLegacySequence(parts, sequence));
}

function compactForFinder(algorithm: string): string {
  return parseSq1Tokens(algorithm).map((token) =>
    token.kind === 'slice' ? '/' : `${token.top},${token.bot}`,
  ).join('');
}

export function sq1PblTargetSetup(top: Sq1PblPll, bottom: Sq1PblPll): string {
  const topTrace = traceSq1Algorithm(top.topSetup);
  const bottomTrace = traceSq1Algorithm(bottom.bottomSetup, top.topSetup);
  if (!topTrace.ok || !bottomTrace.ok) throw new Error('Invalid built-in PBL setup');
  return canonicalSq1Alg(`${top.topSetup} ${bottom.bottomSetup}`);
}

/**
 * Clean-room search matching the JAR's ordered-pair enumeration and stable STM sort.
 * `legacy` preserves its middle-layer omission; `strict` rejects those false positives
 * and deduplicates normalized algorithms.
 */
export function findSq1PblSolutions(
  input: Sq1PblSearchInput,
  onProgress?: (completed: number, total: number) => void,
): Sq1PblSearchResult {
  const mode = input.mode ?? 'legacy';
  const problems = validateSq1PblAuxiliary(input.auxiliary);
  if (problems.length) throw new Error(`Invalid auxiliary algorithms: ${JSON.stringify(problems.slice(0, 8))}`);

  const setup = sq1PblTargetSetup(input.top, input.bottom);
  const total = input.auxiliary.length ** 2;
  const solutions: Array<Sq1PblSolution & { order: number }> = [];
  const strictSeen = new Set<string>();
  const setupState = applySq1PblTokens(SOLVED, parseSq1Tokens(setup), mode);
  const prepared = input.auxiliary.map(item => ({
    item,
    tokens: parseSq1Tokens(item.sequence),
  }));
  let completed = 0;

  for (const first of prepared) {
    const firstState = applySq1PblTokens(setupState, first.tokens, mode);
    for (const second of prepared) {
      // The desktop finder concatenates the two stored strings exactly. Apply
      // that raw candidate for behavioral parity, then normalize only display.
      const raw = `${first.item.sequence}${second.item.sequence}`;
      const state = parsedConcatenationIsComposable(first.item.sequence, second.item.sequence)
        ? applySq1PblTokens(firstState, second.tokens, mode)
        : applySq1PblTokens(setupState, parseSq1Tokens(raw), mode);
      if (isSq1PblSolved(state, mode)) {
        const algorithm = mode === 'legacy'
          ? legacyOptimizeSq1PblSequence(raw)
          : simplifySq1Alg(raw, 'wca');
        if (mode !== 'strict' || !strictSeen.has(algorithm)) {
          strictSeen.add(algorithm);
          const metrics = sq1PblMetrics(algorithm);
          solutions.push({
            algorithm,
            compactAlgorithm: mode === 'legacy' ? algorithm : compactForFinder(algorithm),
            auxiliary: [first.item.name, second.item.name],
            ...metrics,
            order: completed,
          });
        }
      }
      completed += 1;
      if (onProgress && (completed % 4096 === 0 || completed === total)) onProgress(completed, total);
    }
  }

  solutions.sort((left, right) => left.stm - right.stm || left.order - right.order);
  return {
    target: `${input.top.name}/${input.bottom.name}`,
    setup,
    candidateCount: total,
    solutions: solutions.map(({ order: _order, ...solution }) => solution),
  };
}
