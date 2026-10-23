/** Reuse established small solvers offline; independent witness models are shared with regressions. */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { writeExactStateDownloads, type ExactStateRow } from './export-exact-state-downloads.mts';
import { replayIvy, replay223, replaySuperFloppy } from './existing-exact-witness-models';
import * as floppyRef from './exact-witness-models/floppy';
import * as slideRef from './exact-witness-models/slide8';
import * as cm2Ref from './exact-witness-models/cm2';
import * as gearRef from './exact-witness-models/gear';
import * as ufoRef from './exact-witness-models/ufo';
import * as diamondRef from './exact-witness-models/diamond';
import * as bicRef from './exact-witness-models/bic';
import * as duoRef from '@cuberoot/puzzle-solvers/pyraminx-duo-geometry-reference';
const split = (s: string) => s.trim().split(/\s+/).filter(Boolean);
export const legacyReplay: Record<string, (s: string) => unknown> = {
  ivy: replayIvy, '223': replay223, sfl: replaySuperFloppy,
  '133': s => { const v = floppyRef.applySeq(split(s)); return { pieces: v.p, flips: v.f }; },
  '8p': s => { const v = slideRef.applySeq(slideRef.expand(s)); return { grid: v.g, blank: v.blank }; },
  cm2: s => cm2Ref.refApplySeq(split(s)), gear: s => gearRef.refApplySeq(split(s)),
  ufo: s => ufoRef.refApplySeq(split(s)), dmd: s => diamondRef.refApplySeq(split(s)),
  bic: s => {
    let state = [...bicRef.SOLVED];
    for (const token of split(s)) {
      assert(bicRef.refCanMove(state, bicRef.FACE.indexOf(token[0])), 'Bicube witness makes a bandaged turn');
      state = bicRef.refApplyTok(state, token);
    }
    return state;
  },
  pyraminx_duo: s => { const v = duoRef.referenceApply(s); return { centers: v.centers, corners: duoRef.referenceTwists(v) }; },
};
interface Adapter {
  stats(): { total: number; histogram: number[] }; rows(): Iterable<ExactStateRow>;
  solve(s: string): { solution: string; length: number }; apply(s: string): unknown;
  expected: readonly number[];
}
function* keyed(byDepth: Record<number, string[]>): Generator<ExactStateRow> {
  yield { depth: 0, scramble: '' };
  for (const [depth, scrambles] of Object.entries(byDepth)) if (+depth > 0)
    for (const scramble of scrambles) yield { depth: +depth, scramble };
}
async function adapter(event: string): Promise<Adapter> {
  if (event === 'bic') {
    const e = await import('@cuberoot/puzzle-solvers/bicube');
    // Read the existing compact artifact. Never call the high-memory Map builder.
    const raw = gunzipSync(readFileSync(new URL('../../../../stats/scramble/opt_bic.bin.gz', import.meta.url)), { maxOutputLength: 16 * 1024 ** 2 });
    assert.equal(raw.readUInt32LE(4), e.BIC_STATE_COUNT);
    const table = e.deserializeBicTable(raw);
    for (let i = 0; i < table.count; i++) assert(Number.isSafeInteger(table.ranks[i]) && (i === 0 || table.ranks[i] > table.ranks[i - 1]));
    const histogram: number[] = [];
    for (const d of table.dist) histogram[d] = (histogram[d] ?? 0) + 1;
    return { stats: () => ({ total: table.count, histogram }), expected: e.BIC_DIST_HISTOGRAM,
      solve: s => e.solveBicWithTable(table, s), apply: e.bicApply, rows: () => e.streamBicScramblesFromTable(table) };
  }
  if (event === 'pyraminx_duo') {
    const e = await import('@cuberoot/puzzle-solvers/pyraminx-duo');
    return { stats: e.duoGraphStats, expected: e.DUO_LENGTH_DISTRIBUTION, solve: e.solvePyraminxDuo, apply: e.duoApply,
      rows: function* () {
        const nodes = [{ state: duoRef.referenceSolved(), scramble: '', depth: 0 }];
        const seen = new Set([JSON.stringify(nodes[0].state)]);
        for (let head = 0; head < nodes.length; head++) {
          const node = nodes[head]; yield { depth: node.depth, scramble: node.scramble };
          for (const move of duoRef.MOVES) {
            const state = duoRef.referenceMove(node.state, move), key = JSON.stringify(state);
            if (seen.has(key)) continue;
            assert(nodes.length < 324); seen.add(key);
            nodes.push({ state, scramble: `${node.scramble} ${move.token}`.trim(), depth: node.depth + 1 });
          }
        }
        assert.equal(nodes.length, 324);
      } };
  }
  if (event === 'ivy') { const e = await import('@cuberoot/puzzle-solvers/ivy'); return {
    stats: e.ivyGraphStats, expected: e.IVY_LENGTH_DISTRIBUTION, solve: e.solveIvy, apply: e.ivyApply,
    rows: () => keyed(e.ivyAllScramblesByLength()) }; }
  if (event === '223') { const e = await import('../lib/cuboid223-solver'); return {
    stats: e.cuboid223GraphStats, expected: e.CUBOID223_LENGTH_DISTRIBUTION, solve: e.solveCuboid223, apply: e.cuboid223Apply,
    rows: () => keyed(e.cuboid223AllScramblesByLength()) }; }
  if (event === 'sfl') { const e = await import('../lib/superfloppy-solver'); return {
    stats: e.superFloppyGraphStats, expected: e.SUPERFLOPPY_LENGTH_DISTRIBUTION, solve: e.solveSuperFloppy, apply: e.superFloppyApply,
    rows: e.streamSuperFloppyScrambles }; }
  if (event === '133') { const e = await import('../lib/floppy-solver'); return {
    stats: e.floppyGraphStats, expected: e.FLOPPY_LENGTH_DISTRIBUTION, solve: e.solveFloppy, apply: e.floppyApply,
    rows: () => keyed(e.floppyAllScramblesByLength()) }; }
  if (event === '8p') { const e = await import('../lib/slide8-solver'); return {
    stats: e.slide8GraphStats, expected: e.SLIDE8_LENGTH_DISTRIBUTION, solve: e.solveSlide8, apply: e.slide8Apply,
    rows: () => keyed(e.slide8AllScramblesByLength()) }; }
  if (event === 'cm2') { const e = await import('../lib/cm2-solver'); return {
    stats: e.cm2GraphStats, expected: e.CM2_LENGTH_DISTRIBUTION, solve: e.solveCm2, apply: e.cm2Apply, rows: e.cm2AllStates }; }
  if (event === 'gear') { const e = await import('@cuberoot/puzzle-solvers/gear'); return {
    stats: e.gearGraphStats, expected: e.GEAR_LENGTH_DISTRIBUTION, solve: e.solveGear, apply: e.gearApply, rows: e.gearAllStates }; }
  if (event === 'ufo') { const e = await import('../lib/ufo-solver'); return {
    stats: e.ufoGraphStats, expected: e.UFO_LENGTH_DISTRIBUTION, solve: e.solveUfo, apply: e.ufoApply, rows: e.ufoAllStates }; }
  if (event === 'dmd') { const e = await import('../lib/diamond-solver'); return {
    stats: e.diamondGraphStats, expected: e.DIAMOND_LENGTH_DISTRIBUTION, solve: e.solveDiamond, apply: e.diamondApply, rows: e.diamondAllStates }; }
  throw Error(`Unreviewed legacy adapter: ${event}`);
}
export async function enumerateLegacyOffline(event: string) {
  const start = performance.now(), engine = await adapter(event), replay = legacyReplay[event];
  const stats = engine.stats();
  assert.deepEqual(stats.histogram, engine.expected);
  assert.equal(stats.total, stats.histogram.reduce((sum, count) => sum + count, 0));
  const graphMs = performance.now() - start, exportStart = performance.now();
  const examples: Array<{ distance: number; scramble: string; solution: string }> = [];
  const countByDepth: number[] = [], godsNumber = stats.histogram.length - 1;
  const solved = replay(''), validateAll = event === 'pyraminx_duo' || event === '133';
  function* rows() {
    for (const row of engine.rows()) {
      const seen = countByDepth[row.depth] = (countByDepth[row.depth] ?? 0) + 1;
      const retain = seen <= 12 || row.depth === godsNumber && stats.histogram[godsNumber] <= 256;
      if (retain || validateAll) {
        const solution = engine.solve(row.scramble);
        assert.equal(solution.length, row.depth);
        assert.equal(split(row.scramble).length, row.depth);
        assert.equal(split(solution.solution).length, row.depth);
        assert.deepEqual(replay(row.scramble), engine.apply(row.scramble));
        assert.deepEqual(replay(`${row.scramble} ${solution.solution}`), solved);
        if (retain) examples.push({ distance: row.depth, scramble: row.scramble, solution: solution.solution });
      }
      yield row;
    }
  }
  const downloads = writeExactStateDownloads(event, stats.histogram, rows());
  assert.deepEqual(countByDepth, stats.histogram);
  return {
    id: event, stateCount: stats.total, godsNumber, histogram: stats.histogram, examples, downloads,
    metric: 'Established project generator set; see exported bilingual scope and metric.',
    verification: { fullSpaceEnumerated: true, historicalHistogramMatched: true,
      independentlyReplayedExamples: examples.length, fullIndependentGeometryEnumeration: event === 'pyraminx_duo',
      independentlyReplayedStates: validateAll ? stats.total : examples.length,
      boundary: 'Established exact BFS and historical histogram, with independent witness replay. Only Duo additionally enumerates its tiny 324-state independent geometric model.' },
    timingMs: { graph: graphMs, exportAndVerification: performance.now() - exportStart },
    examplesPerDepthLimit: 12, deepestExamplesComplete: stats.histogram[godsNumber] <= 256,
  };
}
