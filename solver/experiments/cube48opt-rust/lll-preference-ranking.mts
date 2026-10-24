/** Personal preference calibration. Scoring consumes move features only, never a
 * case identifier, a library position, or a whole-algorithm lookup. Lower wins.
 * A linear pairwise max-margin model with an MCC prior; implemented locally.
 */
import assert from 'node:assert/strict';
import { algSpeed, analyzeMccGrip } from '../../../core/packages/client/lib/mcc.ts';
import { supportSwitches } from './lll-grip-scoring.mts';
import { wideTurnCount } from './zbll-mcc-notation.mts';

export type Features = Record<string, number>;
export interface RankingExample { body: string; features: Features }
export interface PreferenceGroup { preferred: RankingExample; alternatives: RankingExample[] }
export interface PreferenceModel {
  version: 1; maxGram: number; c: number; epochs: number;
  weights: Record<string, number>; constraints: number; minimumMargin: number;
}

export function moveFeatures(body: string, maxGram = 3): Features {
  assert(Number.isInteger(maxGram) && maxGram >= 0 && maxGram <= 3);
  const ts = body.trim().split(/\s+/).filter(Boolean).map(t => t.replace(/2'$/, '2'));
  assert(ts.length > 0 && ts.length <= 80);
  assert(ts.every(t => /^[RLUDFBrludfbMES](?:2|')?$/.test(t)), 'Body must contain only moves');
  const mcc = algSpeed(ts.join(' '), false, false);
  assert(typeof mcc === 'number' && Number.isFinite(mcc));
  const grip = analyzeMccGrip(ts.join(' '));
  const count = (fn: (s: string) => boolean) => ts.filter(fn).length;
  const f: Features = {
    mcc: mcc / 10, moves: ts.length / 10,
    regrips: grip.events.filter(e => e.kind === 'regrip' && e.beforeMove > 1).length,
    initialResets: grip.events.filter(e => e.kind === 'regrip' && e.beforeMove === 1).length,
    supportSwitches: supportSwitches(ts).length,
    nonHomeHands: Number(grip.start.left !== 0) + Number(grip.start.right !== 0),
    doubles: count(t => t.endsWith('2')) / 4,
    wide: wideTurnCount(ts.join(' ')) / 4,
    slices: count(t => /^[MES]/.test(t)) / 4,
    faces: new Set(ts.map(t => t[0])).size / 4,
  };
  for (const face of 'RLUDFBrludfbMES') f[`face:${face}`] = count(t => t[0] === face) / 4;
  // Short local patterns can transfer between cases; never use a complete alg
  // or position-specific substring. Saturation limits repetition rewards.
  for (let n = 1; n <= maxGram; n++) for (let i = 0; i <= ts.length - n; i++) {
    const key = `moves${n}:${ts.slice(i, i + n).join(' ')}`;
    f[key] = Math.min(2, (f[key] ?? 0) + 1);
  }
  return f;
}

export function preferenceScore(model: Pick<PreferenceModel, 'weights'>, features: Features): number {
  let score = 0;
  for (const [key, value] of Object.entries(features)) score += (model.weights[key] ?? 0) * value;
  return score;
}

/** Margin training does not order the losing alternatives. Numerical noise at
 * equal margins is not a hand preference; use MCC for these score ties. */
export function comparePreference(a: { score: number; mcc: number; body: string }, b: { score: number; mcc: number; body: string }) {
  const quantized = (score: number) => Math.round(score * 1e5);
  return quantized(a.score) - quantized(b.score) || a.mcc - b.mcc
    || wideTurnCount(a.body) - wideTurnCount(b.body) || a.body.localeCompare(b.body);
}

/** Apply the user's hard same-MCC preference after model ranking. Reorder only
 * the slots belonging to each MCC group. A conditional pairwise comparator
 * (wide first for equal MCC, model first otherwise) can create sorting cycles.
 */
export function rankPreference<T extends { score: number; mcc: number; body: string }>(items: readonly T[]): T[] {
  const ranked = [...items].sort(comparePreference);
  const groups = new Map<number, number[]>();
  ranked.forEach((a, i) => { const slots = groups.get(a.mcc) ?? []; slots.push(i); groups.set(a.mcc, slots); });
  for (const slots of groups.values()) {
    const ordered = slots.map(i => ranked[i]).sort((a, b) => wideTurnCount(a.body) - wideTurnCount(b.body) || comparePreference(a, b));
    slots.forEach((slot, i) => { ranked[slot] = ordered[i]; });
  }
  return ranked;
}

/** Dual coordinate descent for 0.5 ||w - w_MCC||² + sum C_i hinge(1-w*d_i).
 * Each case has equal total constraint weight irrespective of candidate count.
 * Vocabulary and optimisation both use the training groups only.
 */
export function trainPreference(groups: PreferenceGroup[], options: { maxGram?: number; c?: number; epochs?: number } = {}): PreferenceModel {
  const maxGram = options.maxGram ?? 3, c = options.c ?? 100, epochs = options.epochs ?? 300;
  const names = [...new Set(['mcc', ...groups.flatMap(g => [g.preferred, ...g.alternatives].flatMap(a => Object.keys(a.features)))])].sort();
  const indices = new Map(names.map((n, i) => [n, i]));
  const weights = new Float64Array(names.length); weights[indices.get('mcc')!] = 1;
  const pairs = groups.flatMap(g => g.alternatives.map(a => {
    const d = new Map<number, number>();
    for (const [key, value] of Object.entries(a.features)) d.set(indices.get(key)!, value);
    for (const [key, value] of Object.entries(g.preferred.features)) d.set(indices.get(key)!, (d.get(indices.get(key)!) ?? 0) - value);
    const entries = [...d].filter(([, v]) => v !== 0);
    const norm = entries.reduce((s, [, v]) => s + v * v, 0);
    return { entries, norm, alpha: 0, limit: c / Math.max(1, g.alternatives.length) };
  }));
  let state = 123456789;
  const order = pairs.map((_, i) => i);
  let usedEpochs = 0;
  for (; usedEpochs < epochs; usedEpochs++) {
    for (let i = order.length - 1; i > 0; i--) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const j = state % (i + 1); [order[i], order[j]] = [order[j], order[i]];
    }
    let maxChange = 0;
    for (const i of order) {
      const p = pairs[i]; if (p.norm === 0) continue;
      let margin = 0; for (const [j, v] of p.entries) margin += weights[j] * v;
      const next = Math.max(0, Math.min(p.limit, p.alpha + (1 - margin) / p.norm));
      const change = next - p.alpha; p.alpha = next;
      maxChange = Math.max(maxChange, Math.abs(change));
      if (change !== 0) for (const [j, v] of p.entries) weights[j] += change * v;
    }
    if (maxChange < 1e-7) { usedEpochs++; break; }
  }
  const minimumMargin = Math.min(...pairs.map(p => p.entries.reduce((s, [i, v]) => s + weights[i] * v, 0)));
  return { version: 1, maxGram, c, epochs: usedEpochs, constraints: pairs.length, minimumMargin,
    weights: Object.fromEntries(names.map((n, i) => [n, weights[i]]).filter(([, w]) => w !== 0)) };
}

export function scoreContributions(model: PreferenceModel, features: Features) {
  return Object.entries(features).map(([feature, value]) => ({ feature, value, contribution: (model.weights[feature] ?? 0) * value }))
    .filter(r => r.contribution !== 0).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
}
