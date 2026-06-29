'use client';

/**
 * First-stage (cross / xcross / xxcross) autofill for the recon solution box.
 *
 * When the solution textarea is empty (or only inspection moves are typed) there
 * is no cross yet, so the OLL/PLL/F2L lookups in `recon_autofill_core` have
 * nothing to match. This module fills that gap by driving the SAME Rust→WASM
 * engine the analyzer's "逐阶段最优解" (StageSolver) uses — producing every
 * OPTIMAL cross / xcross / xxcross solution for whatever color currently sits on
 * the bottom (D-center) of the scrambled cube.
 *
 * Frame handling — the crux (and the source of repeated red/green/orange bugs):
 *   - Everything user-facing (the cube renderer + this Rust engine, which both go
 *     through `cross-solver`'s rotation tables) shares ONE rotation convention.
 *     cubing.js composes whole-cube rotations the other way, so reading the bottom
 *     colour off a cubing.js KPattern disagrees with the render for x-tilted
 *     inspections (`x z` shows RED on the bottom, cubing.js computes green/orange).
 *     So the bottom colour comes from `bottomColorIdx` (cross-solver convention),
 *     NOT from a cubing.js pattern.
 *   - The engine normalizes its input to white-top and returns each solution with
 *     a leading view rotation. We drop that rotation (`splitBody`) — the engine's
 *     face moves solve the cross with the bottom colour on D, and the inspection
 *     frame ALSO has it on D, so the two frames differ only by a whole-cube y.
 *   - We find the single y-power `yk` that makes the relabelled body actually solve
 *     the bottom cross (verified with `crossLength` — the cross-solver, same
 *     convention as the render — so it can't be fooled by a frame mismatch), then
 *     reuse it for every solution. Result: clean pure-face-move cross solutions
 *     with no stray leading rotation, for every inspection / cross colour.
 *
 * Cost: the 'cross' table set is ~27 MB download / ~70 MB worker memory, loaded
 * lazily on the FIRST Tab only (never on page load). Results are cached per
 * scramble+prefix so repeat Tabs / live filtering are instant.
 */

import { simplifyAlg } from './cube3';
import { bottomColorIdx, crossLength, isAnalysableScramble, type CrossColor } from './cross-solver';
import { normalize } from './recon-norm-cross';
import { getRustCrossPool, poolSizeForDevice } from './rust-cross-pool';

export type FirstStageSet = 'cross' | 'xcross' | 'xxcross';

export interface FirstStageSuggestion {
  text: string;
  category: FirstStageSet;
  caseName: string;
  /** HTM move count (excludes leading rotations) — for sorting / display. */
  len: number;
}

export type FirstStageResult =
  | { kind: 'ok'; suggestions: FirstStageSuggestion[] }
  | { kind: 'empty'; reasonKey: string };

// Engine faceIdx → the cross COLOUR it solves, in the engine's normalized
// (white-top / green-front) frame. faceIdx is a FACE-NAME index in the order
// [D, U, L, R, F, B] (matching StageSolver's FACES table); each face's colour is
// its home centre, with home codes U=0 R=1 F=2 L=3 B=4 D=5:
//   0 D→yellow(5) · 1 U→white(0) · 2 L→orange(3) · 3 R→red(1) · 4 F→green(2) · 5 B→blue(4)
//
// This MUST be derived from the face-name order, NOT from "which colour does
// rotation r bring to D". The old code built the map from a FACES_ROT rotation
// list (… "x'", "x") assuming x'/x bring F/B to D — but in cubing.js x'/x bring
// B/F (blue/green) down, so green↔blue silently swapped and every green- or
// blue-bottom cross got solved for the wrong colour (red/orange/white/yellow
// happened to line up, hiding the bug).
const ENGINE_FACE_COLOUR = [5, 0, 3, 1, 2, 4] as const;

// Optimal-only (slack 0), complete enumeration (effectively no cap). The optimal
// set per stage is naturally small; the popup scrolls if needed.
const FIRST_STAGE_CAP = 100000;
const STAGES = [0, 1, 2] as const; // 0 cross · 1 xcross · 2 xxcross

const FAILED = 'recon.autofill.firststage.failed';

const resultCache = new Map<string, FirstStageResult>();
const inflight = new Map<string, Promise<FirstStageResult>>();

function cacheKey(scramble: string, prevMoves: string): string {
  return `${scramble.trim()} ${prevMoves.trim()}`;
}

/** Synchronously read an already-computed result (for instant live re-filtering). */
export function getCachedFirstStage(scramble: string, prevMoves: string): FirstStageResult | undefined {
  return resultCache.get(cacheKey(scramble, prevMoves));
}

/** Compute (or return cached) first-stage suggestions. Loads the engine on first call. */
export function computeFirstStage(scramble: string, prevMoves: string): Promise<FirstStageResult> {
  const key = cacheKey(scramble, prevMoves);
  const cached = resultCache.get(key);
  if (cached) return Promise.resolve(cached);
  let p = inflight.get(key);
  if (!p) {
    p = doCompute(scramble, prevMoves)
      .catch((): FirstStageResult => ({ kind: 'empty', reasonKey: FAILED }))
      .then((r) => { resultCache.set(key, r); inflight.delete(key); return r; });
    inflight.set(key, p);
  }
  return p;
}

const bodyLen = (alg: string): number =>
  alg.replace(/^(?:[xyz][2']?\s+)+/, '').split(/\s+/).filter(Boolean).length;

// Bottom colour → engine faceIdx that solves that colour's cross (-1 if absent).
const colorToFaceIdx = (colour: number): number => (ENGINE_FACE_COLOUR as readonly number[]).indexOf(colour);

// Home colour index → cross-solver CrossColor name (for crossLength verification).
const COLOR_NAME: readonly CrossColor[] = ['White', 'Red', 'Green', 'Orange', 'Blue', 'Yellow'];

// Strip leading whole-cube rotations → the pure face-move body.
function splitBody(alg: string): string {
  const toks = alg.trim().split(/\s+/).filter(Boolean);
  let p = 0;
  while (p < toks.length && /^[xyz][2']?$/.test(toks[p])) p++;
  return toks.slice(p).join(' ');
}

const Y_INV = ['', "y'", 'y2', 'y'] as const;
const Y_PRE = ['', 'y', 'y2', "y'"] as const;
/** Relabel a face-move body through y^k → still pure face moves (the y's cancel
 *  to identity inside `normalize`, leaving no leading rotation). */
function relabelY(body: string, k: number): string {
  if (k === 0) return body;
  const moves = body.split(/\s+/).filter(Boolean);
  if (moves.length === 0) return body;
  return normalize([Y_INV[k], ...moves, Y_PRE[k]]).join(' ');
}

async function doCompute(scramble: string, prevMoves: string): Promise<FirstStageResult> {
  // State at the start of the current line = scramble + any prior (inspection /
  // earlier-line) moves. The bottom color is read from THIS state.
  const eff = [scramble, prevMoves].filter(Boolean).join(' ').trim();
  if (!eff || !isAnalysableScramble(eff)) return { kind: 'empty', reasonKey: FAILED };

  // Bottom colour in the render / engine convention (NOT cubing.js — see header).
  const bottom = bottomColorIdx(eff);
  if (bottom < 0) return { kind: 'empty', reasonKey: FAILED };
  const faceIdx = colorToFaceIdx(bottom);
  if (faceIdx < 0) return { kind: 'empty', reasonKey: FAILED };
  const bottomName = COLOR_NAME[bottom];

  const pool = getRustCrossPool('cross', poolSizeForDevice());
  await pool.ready;

  let yk: number | null = null; // frame y-regrip — identical for every solution
  const out: FirstStageSuggestion[] = [];
  const seen = new Set<string>();
  for (const stage of STAGES) {
    const category: FirstStageSet = stage === 2 ? 'xxcross' : stage === 1 ? 'xcross' : 'cross';
    let res;
    try {
      res = await pool.solveMoves(eff, stage, faceIdx, { extra: 0, cap: FIRST_STAGE_CAP, combo: '' });
    } catch { continue; }
    for (const sol of res.sols) {
      // Engine returns "viewRotation + face moves" in white-top; drop the rotation.
      // Its face moves solve the cross with the bottom colour on D; the inspection
      // frame also has it on D, so the two differ only by a whole-cube y.
      const body = splitBody(sol.m);
      if (!body) continue;
      // Resolve that y-regrip once: pick the y-power whose relabelled body actually
      // solves the bottom cross from the user's real state (crossLength == 0, same
      // rotation convention as the engine/render — immune to frame mismatch).
      if (yk == null) {
        for (let k = 0; k < 4; k++) {
          if (crossLength(`${eff} ${relabelY(body, k)}`, bottomName) === 0) { yk = k; break; }
        }
      }
      const S = simplifyAlg(yk == null ? sol.m : relabelY(body, yk));
      if (!S || seen.has(S)) continue;
      seen.add(S);
      out.push({ text: S, category, caseName: category, len: bodyLen(S) });
    }
  }

  if (out.length === 0) return { kind: 'empty', reasonKey: FAILED };
  // cross first, then xcross, then xxcross; within a stage shortest first.
  const order: Record<FirstStageSet, number> = { cross: 0, xcross: 1, xxcross: 2 };
  out.sort((a, b) => order[a.category] - order[b.category] || a.len - b.len || a.text.localeCompare(b.text));
  return { kind: 'ok', suggestions: out };
}
