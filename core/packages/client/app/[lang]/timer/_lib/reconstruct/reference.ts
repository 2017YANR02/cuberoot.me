/**
 * Per-stage reference solutions — "you took 11 turns here; 7 was available".
 * Research doc P0-4, the half of it that is honestly computable in a browser.
 *
 * Each stage is priced against the best line FROM THE POSITION THE SOLVER WAS
 * ACTUALLY IN, not from the position an ideal solve would have reached. A bad
 * cross must not be charged twice — once as a bad cross and again as the F2L
 * it left behind. So the F2L reference starts from the state after the user's
 * own cross, the OLL reference from after their own F2L, and so on.
 *
 * Where each reference comes from, and what it is worth:
 *
 *   Cross — `optimal`. Exhaustive IDA* over all 18 face turns, depth ≤ 8,
 *     which is the known maximum for a cross. This one is a true optimum.
 *   F2L   — `step-optimal`. csTimer's CFOP driver: each pair solved optimally
 *     in the order the engine picks, D turns excluded (its convention, so the
 *     cross is never disturbed). NOT the global 4-pair optimum — that is a
 *     ~20-turn search no browser will finish. A cuber using D moves or a
 *     clever multi-pair insertion can legitimately beat it, and we say so
 *     rather than clamping the delta at zero.
 *   OLL / PLL — `library-alg`: the shortest alg IN OUR OWN TABLES that is
 *     VERIFIED to solve the exact position the user faced. Not an optimum
 *     either: `oll.json` / `pll.json` hold one or two algs per case, and the
 *     PLL entries are short machine-found solutions, typically 1-4 turns under
 *     the standard human alg. So a small positive delta on the last layer is
 *     normal and not a mistake — it usually means "a shorter alg exists for
 *     this case", which is a fine thing to show a cuber.
 *
 * True last-layer optima are NOT attempted, and this is measured rather than
 * assumed: with this engine an 8-turn OLL takes ~10ms, a 9-turn one ~1.4s, and
 * a 12-turn PLL runs for 220s and still finds nothing. That is why the last
 * layer is priced from the alg tables instead.
 *
 * Two guards keep a wrong number from ever being printed:
 *   - the mask engine's alphabet is single-layer face turns only, so if the
 *     scramble or the user's stream contains anything else (a wide move, a
 *     rotation, garbage) we REFUSE that stage instead of silently dropping the
 *     turn and pricing a position the user was never in. Smart cubes only ever
 *     report face turns, so this costs nothing in practice.
 *   - a last-layer alg is only accepted after it is applied to the actual
 *     state and seen to finish the stage — over every pre-AUF, and (for OLL,
 *     whose algs may contain an x/z rotation) over every cube orientation.
 *     An alg that does not verify is not reported at all.
 *
 * Nothing here is persisted: it is all derived from (scramble, moves) on
 * demand, so a definition fix retroactively fixes every historical report.
 */

import ollData from '@cuberoot/shared/data/oll.json';
import pllData from '@cuberoot/shared/data/pll.json';

import { isOll, isSolved } from '../cube/cfop_detect';
import type { CubeFaces } from '../cube/state';
import { applyScramble } from '../cube/state';
import { parseScramble } from '../cube/moves';
import { recognizeOllExact, recognizePllExact } from '../components/cfop_recognize';
import { CFOP_METHOD, F2L_SLOT_FLAG, solveF2lTo, solveMethodFrom } from '../solver/methods';
import { faceTurnToken } from '../solver/cube3x3';
import { applyOneToken } from './stage_segments';
import type { SolveMove } from './stage_segments';
import type { F2lSlotId, F2lSlotsResult } from './f2l_slots';
import { stmWeight } from './step_metrics';
import type { StepKey, StepMetricsResult } from './step_metrics';

export type ReferenceKind = 'optimal' | 'step-optimal' | 'library-alg';

export type ReferenceNote =
  /** Stage was skipped (XCross / OLL skip / PLL skip): nothing to price. */
  | 'skipped'
  /** Solve never got here (DNF mid-solve). */
  | 'unreached'
  /** OLL/PLL recognizer didn't match — no case, no alg. */
  | 'unrecognized'
  /** A move in the stream (or the scramble) is outside the engine's alphabet. */
  | 'unsupported-moves'
  /** Engine found nothing within its depth bound, or no library alg verified. */
  | 'no-reference';

export interface StageReference {
  step: StepKey;
  /** How the reference was derived; null when there is none. */
  kind: ReferenceKind | null;
  refTurns: number | null;
  /** The reference line itself, space-separated (for display / learning). */
  refSolution: string | null;
  /** The user's comparable turn count: all turns for cross/F2L, execution
   *  turns (leading AUF excluded) for the last layer, because a library alg
   *  contains no AUF either. */
  userTurns: number | null;
  /** userTurns - refTurns. Negative means the cuber beat the reference. */
  delta: number | null;
  note: ReferenceNote | null;
}

export interface ReferenceResult {
  stages: StageReference[];
  /** Totals over the stages that have BOTH numbers — never a mixed sum. */
  refTurns: number | null;
  userTurns: number | null;
  delta: number | null;
}

/** Cube orientations, as move tokens. `isOll`/`isF2l` are center-relative and
 *  therefore already y-invariant, so only the 6 axis choices matter. */
const AXIS_ORIENTATIONS: readonly string[][] = [[], ['x'], ['x2'], ["x'"], ['z'], ["z'"]];

const STEP_ORDER: readonly StepKey[] = ['cross', 'f2l', 'oll', 'pll'];

type OllEntry = { alg?: string; alg2?: string };
const OLL_TABLE = ollData as Record<string, OllEntry>;
const PLL_TABLE = pllData as Record<string, Record<string, string>>;

/** Tokens of an alg, rejecting the alg entirely if any token is unparseable
 *  (`oll.json` has at least one "U'R'" typo — a dropped turn would silently
 *  price the wrong line, so we drop the candidate instead). */
function algTokens(alg: string): string[] | null {
  const raw = alg.trim().split(/\s+/).filter(Boolean);
  if (raw.length === 0) return null;
  for (const t of raw) {
    try {
      if (parseScramble(t).length === 0) return null;
    } catch {
      return null;
    }
  }
  return raw;
}

function algStm(tokens: string[]): number {
  return tokens.reduce((acc, t) => acc + stmWeight(t), 0);
}

function applyTokens(state: CubeFaces, tokens: readonly string[]): CubeFaces {
  let s = state;
  for (const t of tokens) s = applyOneToken(s, t);
  return s;
}

/** OLL-done in ANY cube orientation — some library algs end in a net x/z
 *  rotation, which leaves a perfectly finished stage that a D-anchored test
 *  would call unfinished. */
function isOllAnyOrientation(state: CubeFaces): boolean {
  for (const rot of AXIS_ORIENTATIONS) {
    if (isOll(applyTokens(state, rot))) return true;
  }
  return false;
}

const AUF_TOKENS: readonly string[] = ['', 'U', 'U2', "U'"];

export interface LibraryAlgReference {
  /** Recognized case id ("OLL 21", "Ua"), or 'skip'. */
  case: string;
  /** Turns the reference execution costs: the alg, plus the closing AUF when
   *  the position forces one. The OPENING AUF is not counted — it is
   *  recognition, and the user's leading AUF is excluded too. */
  turns: number;
  /** The line as it would be executed from here (closing AUF included). */
  solution: string;
}

/**
 * Shortest alg in our tables that VERIFIABLY finishes this last-layer
 * position: every candidate alg is tried behind every opening AUF and in front
 * of every closing AUF, and only the ones that actually reach the goal state
 * compete. An alg that does not verify is never reported.
 *
 * Why both AUFs. A case appears in 16 arrangements (4 opening × 4 closing
 * AUFs) and our tables hold one arrangement per alg. Sweeping the opening AUF
 * alone was enough for OLL — orientation cannot be changed by a U turn — but
 * left most PLL positions unpriced, because a PLL is not solved until its
 * closing AUF is done. That closing turn is part of the execution the position
 * demands, so it counts toward the reference; the opening one is not.
 *
 * Exported so `cfop_recognize_coverage.test.ts` can sweep the entire last
 * layer and prove every position gets a reference.
 */
export function shortestLibraryAlg(
  state: CubeFaces,
  layer: 'oll' | 'pll',
): LibraryAlgReference | null {
  let candidates: string[];
  let done: (s: CubeFaces) => boolean;
  let caseId: string;
  if (layer === 'oll') {
    const rec = recognizeOllExact(state);
    if (!rec) return null;
    caseId = rec.case;
    if (caseId === 'skip') return { case: 'skip', turns: 0, solution: '' };
    const entry = OLL_TABLE[caseId];
    candidates = [entry?.alg, entry?.alg2].filter((a): a is string => !!a && !!a.trim());
    done = isOllAnyOrientation;
  } else {
    const rec = recognizePllExact(state);
    if (!rec) return null;
    caseId = rec.case;
    if (caseId === 'skip') return { case: 'skip', turns: 0, solution: '' };
    const entry = PLL_TABLE[caseId];
    candidates = entry ? Object.values(entry).filter(a => !!a && !!a.trim()) : [];
    done = isSolved;
  }

  let best: LibraryAlgReference | null = null;
  for (const cand of candidates) {
    const tokens = algTokens(cand);
    if (!tokens) continue;
    const algTurns = algStm(tokens);
    if (best && algTurns >= best.turns) continue; // can't win even with no AUF
    for (let pre = 0; pre < 4; pre++) {
      let opened = state;
      for (let i = 0; i < pre; i++) opened = applyOneToken(opened, 'U');
      const afterAlg = applyTokens(opened, tokens);
      for (let post = 0; post < 4; post++) {
        const closing = AUF_TOKENS[post];
        const turns = algTurns + (post === 0 ? 0 : 1);
        if (best && turns >= best.turns) continue;
        if (!done(closing ? applyOneToken(afterAlg, closing) : afterAlg)) continue;
        best = {
          case: caseId,
          turns,
          solution: closing ? `${tokens.join(' ')} ${closing}` : tokens.join(' '),
        };
      }
    }
  }
  return best;
}

function emptyRef(step: StepKey, note: ReferenceNote, userTurns: number | null): StageReference {
  return { step, kind: null, refTurns: null, refSolution: null, userTurns, delta: null, note };
}

/**
 * Price every CFOP stage of a solve against a reference line.
 *
 * Returns null when there is nothing to price at all: no moves, no stage walk
 * (non-3x3 or unparseable), or a scramble the engine's alphabet can't express.
 */
export function computeStageReferences(
  scramble: string,
  moves: SolveMove[],
  metrics: StepMetricsResult,
): ReferenceResult | null {
  if (!moves || moves.length === 0) return null;
  if (!scramble || !scramble.trim()) return null;

  // The mask engine replays the scramble as tokens, so a scramble containing
  // anything outside its alphabet costs us the two stages that need that
  // replay (cross, F2L) — but not the last layer, which is priced off the
  // tolerant face walk further down.
  let scrTokens: string[] | null = [];
  for (const raw of scramble.trim().split(/\s+/)) {
    if (!raw) continue;
    const tok = faceTurnToken(raw);
    if (tok === null) { scrTokens = null; break; }
    scrTokens.push(tok);
  }

  const segs = metrics.segments;
  const byStep = new Map(metrics.steps.map(s => [s.step, s]));

  // Convert the user's stream once. A null entry means "the engine can't
  // express this turn"; stages whose prefix contains one get no reference.
  const userTokens = moves.map(mv => faceTurnToken(mv.m));
  const prefixUpTo = (endIdx: number): string[] | null => {
    if (scrTokens === null) return null;
    const out = scrTokens.slice();
    for (let i = 0; i <= endIdx; i++) {
      const tok = userTokens[i];
      if (tok === null) return null;
      out.push(tok);
    }
    return out;
  };

  // Walk the tolerant face model once to snapshot the last-layer positions.
  // This walk (unlike the token prefix above) handles wide moves and
  // rotations, so it stays valid even when the engine's alphabet can't.
  const stateAt = new Map<number, CubeFaces>();
  const wanted = new Set<number>();
  for (const idx of [segs.f2lEndIdx, segs.ollEndIdx]) {
    if (idx !== null && idx !== undefined) wanted.add(idx);
  }
  if (wanted.size > 0) {
    let s: CubeFaces = applyScramble(3, scramble);
    for (let i = 0; i < moves.length; i++) {
      s = applyOneToken(s, moves[i].m);
      if (wanted.has(i)) stateAt.set(i, s);
    }
  }

  const userTurnsFor = (step: StepKey): number | null => {
    const m = byStep.get(step);
    if (!m) return null;
    // Last layer is alg-vs-alg: the leading AUF is recognition, and the
    // reference alg has none, so compare execution turns.
    return step === 'oll' || step === 'pll' ? m.execTurns : m.turns;
  };

  const stages: StageReference[] = [];

  for (const step of STEP_ORDER) {
    const metric = byStep.get(step);
    const userTurns = userTurnsFor(step);
    if (!metric || metric.turns === null) {
      stages.push(emptyRef(step, 'unreached', userTurns));
      continue;
    }
    if (metric.skipped) {
      // Zero turns spent, zero turns owed — a real (and good) outcome.
      stages.push({
        step, kind: null, refTurns: 0, refSolution: null,
        userTurns: 0, delta: 0, note: 'skipped',
      });
      continue;
    }

    if (step === 'cross') {
      if (scrTokens === null) {
        stages.push(emptyRef(step, 'unsupported-moves', userTurns));
        continue;
      }
      const r = solveMethodFrom(scrTokens, CFOP_METHOD, 0, 1);
      const st = r.stages[0];
      if (!st || st.failed) {
        stages.push(emptyRef(step, 'no-reference', userTurns));
        continue;
      }
      const refTurns = st.moves.length;
      stages.push({
        step, kind: 'optimal', refTurns,
        refSolution: st.moves.map(m => m.trim()).join(' '),
        userTurns,
        delta: userTurns !== null ? userTurns - refTurns : null,
        note: null,
      });
      continue;
    }

    if (step === 'f2l') {
      const crossEnd = segs.crossEndIdx;
      if (crossEnd === null || crossEnd === undefined) {
        stages.push(emptyRef(step, 'unreached', userTurns));
        continue;
      }
      const prefix = prefixUpTo(crossEnd);
      if (prefix === null) {
        stages.push(emptyRef(step, 'unsupported-moves', userTurns));
        continue;
      }
      const r = solveMethodFrom(prefix, CFOP_METHOD, 1);
      if (r.stages.length === 0 || r.stages.some(s => s.failed)) {
        stages.push(emptyRef(step, 'no-reference', userTurns));
        continue;
      }
      const refTurns = r.totalMoves;
      stages.push({
        step, kind: 'step-optimal', refTurns,
        refSolution: r.stages.flatMap(s => s.moves).map(m => m.trim()).join(' '),
        userTurns,
        delta: userTurns !== null ? userTurns - refTurns : null,
        note: null,
      });
      continue;
    }

    // Last layer: recognize the case at the previous stage's end, then price
    // it with the shortest library alg that verifiably solves it.
    const fromIdx = step === 'oll' ? segs.f2lEndIdx : segs.ollEndIdx;
    const state = fromIdx !== null && fromIdx !== undefined ? stateAt.get(fromIdx) : undefined;
    if (!state) {
      stages.push(emptyRef(step, 'unreached', userTurns));
      continue;
    }
    const best = shortestLibraryAlg(state, step);
    if (!best) {
      // No case recognized at all, versus a case with no alg that verifies.
      const recognized = step === 'oll'
        ? recognizeOllExact(state) !== null
        : recognizePllExact(state) !== null;
      stages.push(emptyRef(step, recognized ? 'no-reference' : 'unrecognized', userTurns));
      continue;
    }
    if (best.case === 'skip') {
      // The walker said this stage took turns, but the position it started
      // from was already finished — only reachable if the two disagree, so
      // report it as nothing-to-price rather than inventing a number.
      stages.push({
        step, kind: null, refTurns: 0, refSolution: null,
        userTurns, delta: null, note: 'skipped',
      });
      continue;
    }
    stages.push({
      step, kind: 'library-alg', refTurns: best.turns, refSolution: best.solution,
      userTurns,
      delta: userTurns !== null ? userTurns - best.turns : null,
      note: null,
    });
  }

  let refTotal: number | null = null;
  let userTotal: number | null = null;
  for (const s of stages) {
    if (s.refTurns === null || s.userTurns === null) continue;
    refTotal = (refTotal ?? 0) + s.refTurns;
    userTotal = (userTotal ?? 0) + s.userTurns;
  }

  return {
    stages,
    refTurns: refTotal,
    userTurns: userTotal,
    delta: refTotal !== null && userTotal !== null ? userTotal - refTotal : null,
  };
}

/* ------------------------------------------------------------------ */
/* F2L, priced one pair at a time                                      */
/* ------------------------------------------------------------------ */

export interface SlotReference {
  slot: F2lSlotId;
  /** Turns the shortest line costs for THIS pair, given everything already in. */
  refTurns: number | null;
  refSolution: string | null;
  userTurns: number | null;
  /** userTurns - refTurns. Negative means the cuber beat the reference — which
   *  is reachable here, see the D-turn note below. */
  delta: number | null;
  note: ReferenceNote | null;
}

/**
 * Price each F2L pair against the shortest line that solves THAT pair while
 * leaving the cross and every already-finished pair standing.
 *
 * This is a different question from the whole-F2L reference above, and a
 * strictly harder one for the reference to win: it is charged from the position
 * the cuber was actually in when they started that pair, and it may not disturb
 * the pairs they had already placed. So the four slot numbers do NOT sum to the
 * F2L number — pricing the block as a whole lets the engine reorder the pairs
 * and multislot, which is cheaper. Both are printed, and they are not the same
 * claim; nothing adds them together.
 *
 * Same D-turn caveat as the block reference (it is the same alphabet): a cuber
 * who inserts with D moves can legitimately come in UNDER the reference. We
 * report that as a negative delta rather than clamping it to zero, because
 * "you found something the engine's move set can't express" is the truth.
 *
 * Returns null when there is nothing to price at all.
 */
export function computeF2lSlotReferences(
  scramble: string,
  moves: SolveMove[],
  slots: F2lSlotsResult,
): SlotReference[] | null {
  if (!moves || moves.length === 0) return null;
  if (!scramble || !scramble.trim()) return null;
  const crossEndIdx = slots.segments.crossEndIdx;
  if (crossEndIdx === null || crossEndIdx === undefined) return null;

  const scrTokens: string[] = [];
  for (const raw of scramble.trim().split(/\s+/)) {
    if (!raw) continue;
    const tok = faceTurnToken(raw);
    // One token the engine can't express and every pair is unpriceable — the
    // position we would be searching from is not the one the cuber was in.
    if (tok === null) {
      return slots.slots.map(s => ({
        slot: s.slot, refTurns: null, refSolution: null,
        userTurns: s.turns, delta: null, note: 'unsupported-moves' as ReferenceNote,
      }));
    }
    scrTokens.push(tok);
  }
  const userTokens = moves.map(mv => faceTurnToken(mv.m));

  const out: SlotReference[] = [];
  // Pairs already standing when the cross landed cost nothing and block nothing
  // — but they DO have to be in the mask, or the search is free to take them
  // apart and we would be pricing a line the cuber could not have used.
  let standing = 0;
  for (const s of slots.slots) if (s.free) standing |= F2L_SLOT_FLAG[s.slot];
  let prevEndIdx = crossEndIdx;

  for (const s of slots.slots) {
    if (s.free) {
      out.push({
        slot: s.slot, refTurns: 0, refSolution: null,
        userTurns: 0, delta: 0, note: 'skipped',
      });
      continue;
    }
    if (s.endIdx === null) {
      out.push({
        slot: s.slot, refTurns: null, refSolution: null,
        userTurns: s.turns, delta: null, note: 'unreached',
      });
      continue;
    }
    const prefix = scrTokens.slice();
    let expressible = true;
    for (let i = 0; i <= prevEndIdx; i++) {
      const tok = userTokens[i];
      if (tok === null) { expressible = false; break; }
      prefix.push(tok);
    }
    if (!expressible) {
      out.push({
        slot: s.slot, refTurns: null, refSolution: null,
        userTurns: s.turns, delta: null, note: 'unsupported-moves',
      });
      standing |= F2L_SLOT_FLAG[s.slot];
      prevEndIdx = s.endIdx;
      continue;
    }
    const want = standing | F2L_SLOT_FLAG[s.slot];
    const sol = solveF2lTo(prefix, want);
    if (sol === null) {
      out.push({
        slot: s.slot, refTurns: null, refSolution: null,
        userTurns: s.turns, delta: null, note: 'no-reference',
      });
    } else {
      const refTurns = sol.length;
      out.push({
        slot: s.slot,
        refTurns,
        refSolution: sol.map(m => m.trim()).join(' '),
        userTurns: s.turns,
        delta: s.turns !== null ? s.turns - refTurns : null,
        note: null,
      });
    }
    standing = want;
    prevEndIdx = s.endIdx;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Turning a delta into a word                                         */
/* ------------------------------------------------------------------ */

/**
 * The one-word verdict on a step, or null for "nothing worth saying".
 *
 * Only two words, and both mean something exact:
 *   'optimal'   — you used as many turns as the reference. For the cross that
 *                 IS the optimum; for the last layer it is the shortest alg in
 *                 our tables; for an F2L pair it is the shortest insertion that
 *                 leaves the finished pairs alone.
 *   'brilliant' — you used FEWER. Only reachable where the reference is not a
 *                 true optimum (an F2L pair solved with D turns, a last-layer
 *                 alg shorter than anything we hold), which is precisely when
 *                 the cuber deserves to hear about it.
 *
 * Everything slower gets no badge: the `+N` the table already prints says it
 * better than a third adjective would, and a badge on every column is a badge
 * on none.
 */
export type StepGrade = 'optimal' | 'brilliant';

export function gradeForDelta(delta: number | null | undefined): StepGrade | null {
  if (delta === null || delta === undefined) return null;
  if (delta < 0) return 'brilliant';
  if (delta === 0) return 'optimal';
  return null;
}
