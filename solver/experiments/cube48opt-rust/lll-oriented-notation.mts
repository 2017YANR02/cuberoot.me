/** Starting orientation is metadata; the executed body still obeys the move whitelist.
 * Boundary AUF remains in the original case frame. No rotations inside the body.
 * No large tables, solver launches, or reference-algorithm injection here.
 */
import assert from 'node:assert/strict';
import { CUBE_ORIENTATIONS } from '../../../core/packages/shared/src/timer/cube-orientation.ts';
import { strictOuterForm } from '../../../core/packages/shared/src/timer/reconstruct/library_correction.ts';
import { algSpeed, getSTM } from '../../../core/packages/client/lib/mcc.ts';
import { improveNotation, isAllowedZbllAlgorithm, compareZbllNotation, wideTurnCount } from './zbll-mcc-notation.mts';
import { scoreGripCandidate } from './lll-grip-scoring.mts';

export const moveTokens = (s: string) => s.trim().split(/\s+/).filter(Boolean);
export const outerKey = (s: string) => strictOuterForm(moveTokens(s)).key;
export const inverseTokens = (s: string) => moveTokens(s).reverse().map(t => t.endsWith('2') ? t : t.endsWith("'") ? t.slice(0, -1) : t + "'").join(' ');
export const joinMoves = (...s: string[]) => s.filter(Boolean).join(' ');
/** A library setup can finish in a rotated centre frame (e.g. V's d').
 * Keep its literal spelling and record the correction explicitly. */
export function fixedCaseSetup(sourceSetup: string) {
  const form = strictOuterForm(moveTokens(sourceSetup));
  const orientationCorrection = inverseTokens(form.rotation.join(' '));
  return { sourceSetup, orientationCorrection, algorithm: joinMoves(sourceSetup, orientationCorrection), canonical: form.key };
}
export interface OrientedAlgorithm {
  preAuf: string; orientation: string; body: string; restoreOrientation: string; postAuf: string;
}
const rotation = (s: string) => moveTokens(s).every(t => /^[xyz](?:2|')?$/.test(t));
const auf = (s: string) => !s || /^U(?:2|')?$/.test(s);
export function executableAlgorithm(a: OrientedAlgorithm): string {
  assert(auf(a.preAuf) && auf(a.postAuf));
  assert(rotation(a.orientation) && rotation(a.restoreOrientation));
  assert(isAllowedZbllAlgorithm(a.body) && a.body, 'Forbidden move/rotation in algorithm body');
  assert.equal(strictOuterForm(moveTokens(a.body)).rotation.length, 0, 'Body must preserve its centre frame');
  assert.equal(strictOuterForm(moveTokens(joinMoves(a.orientation, a.restoreOrientation))).rotation.length, 0);
  return joinMoves(a.preAuf, a.orientation, a.body, a.restoreOrientation, a.postAuf);
}
export function scoreOriented(a: OrientedAlgorithm) {
  const algorithm = executableAlgorithm(a);
  const mcc = algSpeed(a.body, false, false); // U after x is not original-frame AUF.
  assert(typeof mcc === 'number' && Number.isFinite(mcc));
  return { ...a, algorithm, mcc, stm: getSTM(a.body, false), ...scoreGripCandidate(a.body, mcc) };
}
export type ScoredOriented = ReturnType<typeof scoreOriented>;
export function compareOriented(a: ScoredOriented, b: ScoredOriented) {
  return a.mcc - b.mcc || wideTurnCount(a.body) - wideTurnCount(b.body)
    || a.stm - b.stm || compareZbllNotation(a.body, b.body)
    || moveTokens(a.orientation).length - moveTokens(b.orientation).length || a.algorithm.localeCompare(b.algorithm);
}
/** Only remove AUF in the original, fixed case frame, before changing viewpoint. */
export function splitOuterAuf(path: string) {
  const ts = moveTokens(path);
  const preAuf = ts[0]?.[0] === 'U' ? ts.shift()! : '';
  const postAuf = ts.at(-1)?.[0] === 'U' ? ts.pop()! : '';
  return { preAuf, core: ts.join(' '), postAuf };
}
export function orientedSpellings(path: string, orientations: readonly string[] = CUBE_ORIENTATIONS.map(o => o.value)): ScoredOriented[] {
  const canonical = outerKey(path), { preAuf, core, postAuf } = splitOuterAuf(canonical);
  const result = new Map<string, ScoredOriented>();
  for (const orientation of orientations) {
    assert(CUBE_ORIENTATIONS.some(o => o.value === orientation), 'Unknown starting orientation');
    const restoreOrientation = inverseTokens(orientation);
    const relative = outerKey(joinMoves(restoreOrientation, core, orientation));
    for (const body of improveNotation(relative, { preserveOrientation: true, beamPerFrame: 8,
      completeBoundaryAUF: true, ignoreBoundaryAUF: false })) {
      const candidate = scoreOriented({ preAuf, orientation, body, restoreOrientation, postAuf });
      assert.equal(outerKey(candidate.algorithm), canonical, 'Changed move path while changing starting orientation');
      assert.equal(strictOuterForm(moveTokens(candidate.algorithm)).rotation.length, 0);
      result.set(candidate.algorithm, candidate);
    }
  }
  return [...result.values()].sort(compareOriented);
}
/** Parse a literal library control without rewriting its body. Only boundary
 * rotations and original-frame AUF can be separated from the moves. */
export function splitLiteralOrientation(algorithm: string): OrientedAlgorithm | null {
  const ts = moveTokens(algorithm);
  const preAuf = ts[0]?.[0] === 'U' ? ts.shift()! : '';
  const postAuf = ts.at(-1)?.[0] === 'U' ? ts.pop()! : '';
  const initial: string[] = [], final: string[] = [];
  while (ts.length && /^[xyz]/.test(ts[0])) initial.push(ts.shift()!);
  while (ts.length && /^[xyz]/.test(ts.at(-1)!)) final.unshift(ts.pop()!);
  const a = { preAuf, postAuf, orientation: initial.join(' '), restoreOrientation: final.join(' '), body: ts.join(' ') };
  try { executableAlgorithm(a); return a; } catch { return null; }
}
