/**
 * Derive the full Pyraminx distribution without BFS or a full-state table.
 * In cubing.js, a main turn rotates both its axial corner and tip. The relative
 * tip coordinate (tip orientation - axial corner orientation) removes that
 * coupling. The standard 16 moves then act on exactly one factor of
 * Tetraminx x C3 x C3 x C3 x C3, so graph distances add exactly.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { Alg, Move } from 'cubing/alg';
import { KPuzzle, KPattern } from 'cubing/kpuzzle';
import { getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { puzzles } from 'cubing/puzzles';
import { PG_PUZZLES } from '../app/[lang]/sim/pgCatalog';
import type { ResumableExactStates } from './exact-coordinate-bfs.mts';

type Example = { depth: number; distance: number; scramble: string; solution: string };
interface CoreReport {
  event: string; completed: boolean; total: number; godsNumber: number; histogram: number[];
  examples: Example[];
  verification: { closed: boolean; directedEdgesChecked: number;
    allEdgesDistanceDifferenceAtMostOne: boolean; allNonRootStatesHaveDescendingEdge: boolean;
    referenceHistogramMatches: boolean; moveNames: string[] };
}
const TIP_HISTOGRAM = [1, 8, 24, 32, 16];
const MAIN_MOVES = ['U', 'L', 'R', 'B'];
const TIP_MOVES = MAIN_MOVES.map(move => move.toLowerCase());
const MOVES = [...MAIN_MOVES, ...TIP_MOVES].flatMap(move => [move, `${move}'`]);
const tokens = (alg: string) => alg.trim().split(/\s+/).filter(Boolean);
const identity = (permutation: readonly number[]) => permutation.every((piece, slot) => piece === slot);
const relativeTips = (pattern: KPattern) => pattern.patternData.CORNERS2.orientation.map((value, i) =>
  (value - pattern.patternData.CORNERS.orientation[i] + 3) % 3);

function tipCoordinates() {
  return Array.from({ length: 81 }, (_, rank) => {
    let rest = rank;
    const values = TIP_MOVES.map(() => { const value = rest % 3; rest = Math.floor(rest / 3); return value; });
    const alg = TIP_MOVES.flatMap((move, i) => values[i] ? [values[i] === 1 ? move : `${move}'`] : []).join(' ');
    return { values, alg, depth: values.filter(Boolean).length };
  });
}

/** Stream the direct product from standard-notation core rows; no full graph.
 * The caller keeps the single tipless distance table resident for both exports.
 */
export function pyraminxTipsAllStates(coreStates: ResumableExactStates, coreCount = 933120): ResumableExactStates {
  const tips = tipCoordinates();
  assert.equal(coreStates.total, coreCount, 'Tip product core state count differs');
  const total = coreCount * tips.length;
  const resumeKey = createHash('sha256').update(readFileSync(new URL(import.meta.url)))
    .update(coreStates.resumeKey).update(JSON.stringify([coreCount, tips])).digest('hex');
  function* resume(startRow: number) {
    assert(Number.isSafeInteger(startRow) && startRow >= 0 && startRow <= total);
    let count = Math.floor(startRow / tips.length), firstTip = startRow % tips.length;
    for (const core of coreStates.resume(count)) {
      assert(Number.isInteger(core.depth) && core.depth >= 0 && core.depth <= 11);
      assert(/^(?:[ULRB]'?(?: |$))*$/.test(core.scramble), 'Core export must use standard U/L/R/B notation');
      for (let i = firstTip; i < tips.length; i++) { const tip = tips[i]; yield {
        depth: core.depth + tip.depth,
        scramble: core.scramble && tip.alg ? `${core.scramble} ${tip.alg}` : core.scramble || tip.alg,
      }; }
      firstTip = 0;
      count++;
    }
    assert.equal(count, coreCount, 'Tip product did not receive the complete core');
  }
  return { total, resumeKey, resume, [Symbol.iterator]: () => resume(0) };
}

/** Pure exact integer convolution; no puzzle search, state table or sampling. */
export function convolvePyraminxTips(coreHistogram: readonly number[]): number[] {
  assert(coreHistogram.length > 0 && coreHistogram.every(value => Number.isSafeInteger(value) && value >= 0));
  const histogram = new Array<number>(coreHistogram.length + 4).fill(0);
  for (let core = 0; core < coreHistogram.length; core++) {
    for (let tips = 0; tips < TIP_HISTOGRAM.length; tips++) histogram[core + tips] += coreHistogram[core] * TIP_HISTOGRAM[tips];
  }
  assert(histogram.every(Number.isSafeInteger));
  return histogram;
}

export async function derivePyraminxTips(core: CoreReport, provenance: { path: string; sha256: string }) {
  const start = performance.now();
  assert.equal(core.event, 'tetraminx');
  assert.equal(core.completed, true);
  assert.equal(core.total, 933120);
  assert.equal(core.godsNumber, 11);
  assert.equal(core.histogram.length, 12);
  assert.equal(core.histogram.reduce((sum, count) => sum + count, 0), core.total);
  assert.equal(core.verification.directedEdgesChecked, core.total * 8);
  assert(core.verification.closed && core.verification.allEdgesDistanceDifferenceAtMostOne
    && core.verification.allNonRootStatesHaveDescendingEdge && core.verification.referenceHistogramMatches);
  assert.match(provenance.sha256, /^[a-f0-9]{64}$/);

  const histogram = convolvePyraminxTips(core.histogram);
  const total = histogram.reduce((sum, count) => sum + count, 0);
  assert.equal(total, core.total * 81);
  assert.equal(total, 75582720);
  assert.equal(histogram.length - 1, 15);
  assert.equal(histogram.at(-1), 512);
  const convolutionMs = performance.now() - start;
  const verifyStart = performance.now();
  const catalog = PG_PUZZLES.find(puzzle => puzzle.id === 'tetraminx');
  assert(catalog);
  const geometry = getPuzzleGeometryByDesc(catalog.def, { allMoves: true, orientCenters: false, addRotations: false });
  const tipless = new KPuzzle(geometry.getKPuzzleDefinition(true));
  const full = await puzzles.pyraminx.kpuzzle();
  const solved = full.defaultPattern();
  assert.deepEqual(full.definition.orbits, [
    { orbitName: 'EDGES', numPieces: 6, numOrientations: 2 },
    { orbitName: 'CORNERS', numPieces: 4, numOrientations: 3 },
    { orbitName: 'CORNERS2', numPieces: 4, numOrientations: 3 },
  ]);
  const externalToInternal = new Map<string, string>();
  const internalToExternal = new Map<string, string>();
  for (const internal of core.verification.moveNames) {
    const external = geometry.notationMapper.notationToExternal(new Move(internal))?.toString();
    assert(external && /^[ULRB]'?$/.test(external));
    internalToExternal.set(internal, external);
    externalToInternal.set(external, internal);
  }
  assert.equal(externalToInternal.size, 8);
  const externalAlg = (alg: string) => tokens(alg).map(token => {
    const external = internalToExternal.get(token);
    assert(external, `Not a core generator: ${token}`);
    return external;
  }).join(' ');

  // Independently generated KPuzzles number their edges differently. Each
  // edge's incident pair of turning vertices provides an unambiguous relabeling.
  const incidence = (puzzle: KPuzzle, names: string[], slot: number) => names.map(name =>
    Number(puzzle.moveToTransformation(name).transformationData.EDGES.permutation[slot] !== slot)).join('');
  const mainInternal = MAIN_MOVES.map(move => externalToInternal.get(move)!);
  const edgeRelabeling = Array.from({ length: 6 }, (_, slot) => {
    const signature = incidence(tipless, mainInternal, slot);
    const matches = Array.from({ length: 6 }, (_, i) => i).filter(i => incidence(full, MAIN_MOVES, i) === signature);
    assert.equal(matches.length, 1);
    return matches[0];
  });
  assert.equal(new Set(edgeRelabeling).size, 6);
  const fullToCore = (pattern: KPattern) => ({
    EDGES: { pieces: edgeRelabeling.map(slot => edgeRelabeling.indexOf(pattern.patternData.EDGES.pieces[slot])),
      orientation: edgeRelabeling.map(slot => pattern.patternData.EDGES.orientation[slot]) },
    CORNERS: pattern.patternData.CORNERS,
  });
  assert.deepEqual(fullToCore(solved), tipless.defaultPattern().patternData);
  const tipAxis = new Map<string, number>();
  for (const move of MOVES) {
    const transformation = full.moveToTransformation(move);
    const data = transformation.transformationData;
    assert.equal(transformation.repetitionOrder(), 3);
    assert(identity(data.CORNERS.permutation) && identity(data.CORNERS2.permutation));
    if (move === move.toUpperCase()) {
      assert.deepEqual(data.CORNERS2.orientationDelta, data.CORNERS.orientationDelta);
      const original = tipless.moveToTransformation(externalToInternal.get(move)!).transformationData;
      assert.deepEqual(data.CORNERS, original.CORNERS);
      for (let slot = 0; slot < 6; slot++) {
        assert.equal(data.EDGES.permutation[edgeRelabeling[slot]], edgeRelabeling[original.EDGES.permutation[slot]]);
        assert.equal(data.EDGES.orientationDelta[edgeRelabeling[slot]], original.EDGES.orientationDelta[slot]);
      }
    } else {
      assert(identity(data.EDGES.permutation));
      assert(data.EDGES.orientationDelta.every(value => value === 0));
      assert(data.CORNERS.orientationDelta.every(value => value === 0));
      assert.equal(data.CORNERS2.orientationDelta.filter(value => value !== 0).length, 1);
      const axis = data.CORNERS2.orientationDelta.findIndex(value => value !== 0);
      assert.equal(data.CORNERS2.orientationDelta[axis], move.endsWith("'") ? 2 : 1);
      tipAxis.set(move, axis);
    }
  }
  assert.equal(new Set(TIP_MOVES.map(move => tipAxis.get(move))).size, 4);
  // The algebraic checks above establish all-state separation. These replay
  // probes additionally check the library's pattern application conventions.
  let probe = solved, seed = 0x7142d391, independentTransitionChecks = 0;
  for (let step = 0; step < 64; step++) {
    for (const move of MOVES) {
      const next = probe.applyMove(move), expectedRelative = relativeTips(probe);
      if (move === move.toUpperCase()) {
        const projected = new KPattern(tipless, fullToCore(probe));
        assert.deepEqual(fullToCore(next), projected.applyMove(externalToInternal.get(move)!).patternData);
      } else {
        assert.deepEqual(fullToCore(next), fullToCore(probe));
        const axis = tipAxis.get(move)!;
        expectedRelative[axis] = (expectedRelative[axis] + (move.endsWith("'") ? 2 : 1)) % 3;
      }
      assert.deepEqual(relativeTips(next), expectedRelative);
      independentTransitionChecks++;
    }
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    probe = probe.applyMove(MOVES[(seed >>> 16) % MOVES.length]);
  }
  const tipStates = tipCoordinates().map(({ values, alg, depth }) => {
    const relative = new Array<number>(4).fill(0);
    TIP_MOVES.forEach((move, i) => { relative[tipAxis.get(move)!] = values[i]; });
    const pattern = solved.applyAlg(alg);
    assert.deepEqual(fullToCore(pattern), tipless.defaultPattern().patternData);
    assert.deepEqual(relativeTips(pattern), relative);
    return { alg, depth, relative };
  });
  assert.deepEqual(TIP_HISTOGRAM, Array.from({ length: 5 }, (_, depth) => tipStates.filter(tip => tip.depth === depth).length));
  let verificationMs = performance.now() - verifyStart;
  const exampleStart = performance.now();
  const byDepth = histogram.map(() => [] as Example[]);
  const seenCore = new Set<string>();
  for (const sample of core.examples) {
    assert.equal(sample.depth, sample.distance);
    assert.equal(tokens(sample.scramble).length, sample.depth);
    assert.equal(tokens(sample.solution).length, sample.depth);
    const coreState = tipless.defaultPattern().applyAlg(sample.scramble);
    const key = JSON.stringify(coreState.patternData);
    assert(!seenCore.has(key), 'Duplicate core witness');
    seenCore.add(key);
    const main = externalAlg(sample.scramble);
    const fullState = solved.applyAlg(main);
    assert.deepEqual(fullToCore(fullState), coreState.patternData);
    assert(relativeTips(fullState).every(value => value === 0));
    assert(fullState.applyAlg(externalAlg(sample.solution)).isIdentical(solved));
    for (const tip of tipStates) {
      const depth = sample.depth + tip.depth;
      if (byDepth[depth].length >= Math.min(12, histogram[depth])) continue;
      const scramble = [main, tip.alg].filter(Boolean).join(' ');
      byDepth[depth].push({ depth, distance: depth, scramble, solution: new Alg(scramble).invert().toString() });
    }
  }
  byDepth.forEach((examples, depth) => assert.equal(examples.length, Math.min(12, histogram[depth])));
  const examples = byDepth.flat();
  const examplesMs = performance.now() - exampleStart;
  const finalVerifyStart = performance.now();
  const seen = new Set<string>();
  for (const example of examples) {
    const pattern = solved.applyAlg(example.scramble);
    assert(pattern.applyAlg(example.solution).isIdentical(solved));
    assert.equal(tokens(example.scramble).length, example.depth);
    assert.equal(tokens(example.solution).length, example.depth);
    assert(tokens(example.scramble).every(move => MOVES.includes(move)));
    const key = JSON.stringify(pattern.patternData);
    assert(!seen.has(key), 'Duplicate full witness');
    seen.add(key);
  }
  verificationMs += performance.now() - finalVerifyStart;
  return {
    id: 'pyram-tips', event: 'pyram-tips', label: 'Pyraminx including tips / 金字塔（含小尖）',
    metric: 'fixed vertex frame; each U/L/R/B/u/l/r/b +/-120-degree turn = 1; whole rotations ignored',
    stateCount: total, total, godsNumber: histogram.length - 1, histogram, examples,
    examplesLimitPerDepth: 12, deepestExamplesComplete: false,
    timingMs: { graph: 0, derivation: convolutionMs, examples: examplesMs, solve: 0, verification: verificationMs },
    verification: {
      closed: true, fullSpaceEnumerated: false, proofMethod: 'verified-direct-product-distance-convolution',
      completeViaDirectProduct: true, coreReportSha256: provenance.sha256,
      coreHistogram: core.histogram, tipHistogram: TIP_HISTOGRAM,
      generatorSeparationChecks: MOVES.length,
      referenceHistogramAvailable: false,
      edgeProof: 'Inherited core distance certificate plus exact C3 factor distances; no full-graph edge scan was run.',
      sourceCoreProof: { closed: core.verification.closed,
        directedEdgesChecked: core.verification.directedEdgesChecked,
        allEdgesDistanceDifferenceAtMostOne: core.verification.allEdgesDistanceDifferenceAtMostOne,
        allNonRootStatesHaveDescendingEdge: core.verification.allNonRootStatesHaveDescendingEdge },
      proof: 'Every legal generator acts on one factor of the Cartesian product. Factor distances give a lower bound for every path; concatenated shortest factor paths attain the same bound.',
      independentlyVerifiedGenerators: MOVES.length, independentTransitionChecks,
      independentlyReplayedTipStates: tipStates.length, independentlyReplayedCoreExamples: core.examples.length,
      independentlyReplayedExamples: examples.length, moveNames: MOVES, edgeRelabeling,
      scope: 'complete Pyraminx including all four independent tips; no sampling of the distribution',
      decomposition: {
        coreReport: provenance, coreTotal: core.total, coreGodsNumber: core.godsNumber,
        coreHistogram: core.histogram, tipTotal: 81, tipHistogram: TIP_HISTOGRAM,
        tipCoordinate: '(CORNERS2.orientation[i] - CORNERS.orientation[i]) mod 3',
        cartesianProductVerified: true, additiveDistanceVerified: true,
        proof: 'All eight main generators match the verified core graph under the recorded edge relabeling and preserve relative tips. Each of the eight tip generators fixes the core and changes exactly one relative tip by +/-1. Every pair is reachable. Any path needs at least the core distance plus one move per nonzero tip, and concatenating shortest factor paths attains this bound.',
      },
    },
    source: { method: 'Exact polynomial convolution; no BFS', engine: 'scripts/derive-pyraminx-tips-distribution.mts' },
    recomputedExistingDistribution: false,
    elapsedMs: performance.now() - start,
    timingBoundary: 'Derivation and bounded independent replay only; no BFS, distance-table allocation, or resource-baseline reset. Excludes Node startup, imports and final persistence.',
  };
}

async function main() {
  const args = process.argv.slice(2);
  assert.equal(args.length, 2, 'Usage: derive-pyraminx-tips-distribution.mts CORE_REPORT OUTPUT_JSON');
  const input = resolve(args[0]), output = resolve(args[1]);
  assert(output.endsWith('.json'));
  const bytes = await readFile(input);
  const result = await derivePyraminxTips(JSON.parse(bytes.toString('utf8')), {
    path: input, sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  const csvPath = output.replace(/\.json$/, '.csv');
  const csv = ['depth,count,probability', ...result.histogram.map((count, depth) => `${depth},${count},${count / result.total}`)].join('\n') + '\n';
  await mkdir(dirname(output), { recursive: true });
  await writeFile(`${csvPath}.tmp`, csv);
  await rename(`${csvPath}.tmp`, csvPath);
  const report = { ...result, completed: true, generatedAt: new Date().toISOString(),
    maxRssBytes: process.resourceUsage().maxRSS * 1024,
    csv: { path: csvPath, sha256: createHash('sha256').update(csv).digest('hex') } };
  await writeFile(`${output}.tmp`, `${JSON.stringify(report, null, 2)}\n`);
  await rename(`${output}.tmp`, output);
  console.log(JSON.stringify({ output, total: result.total, godsNumber: result.godsNumber,
    histogram: result.histogram, examples: result.examples.length, elapsedMs: result.elapsedMs, maxRssBytes: report.maxRssBytes }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
