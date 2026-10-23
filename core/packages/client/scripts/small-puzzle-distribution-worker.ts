/** One complete small-puzzle BFS per process. Run through the serial resource guard.
 * CLI: node --max-old-space-size=128 --import tsx SCRIPT EVENT OUTPUT.json
 * Existing solver test references supply small independent witness replayers, not another BFS.
 * The JSON rename is the completion marker; the CSV is written first. Never overwrites results.
 */
import { replayIvy, replay223, replaySuperFloppy } from "./existing-exact-witness-models";
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { EXACT_DOWNLOAD_JOBS, type ExactDownloadJob } from './prepare-exact-state-downloads.mts';

type ExistingEvent = 'ivy' | '223' | 'skewb' | 'sfl';
type ExtraEvent = "offline-bic" | "offline-ivy" | "offline-223" | "offline-sfl" | "offline-133" | "offline-8p" | "offline-cm2" | "offline-gear" | "offline-ufo" | "offline-dmd" | "offline-pyraminx_duo" | "lsemu-qtm" | "roux-eolr-ac" | "roux-eolr-mc" | "roux-eodm";
type Event = ExactDownloadJob | ExtraEvent | ExistingEvent | 'tetraminx' | 'jingpyraminx' | 'pyramorphix' | 'pyramorphix-qtm' | 'dino' | 'half' | 'lsemu' | 'htr-dr' | 'fr-htr';
type Solution = { solution: string; length: number };
type Example = { depth: number; scramble: string; solution: string; length: number };
type Replay = (algorithm: string) => unknown;
interface Adapter {
  stats: () => { total: number; histogram: number[] };
  examples: () => Record<number, string[]>;
  solve: (scramble: string) => Solution;
  apply: Replay;
  reference: Replay | null;
  source: string;
}
const MIB = 1024 ** 2;
const MAX_HEAP_BYTES = 128 * MIB, MAX_RSS_BYTES = 512 * MIB;
const scriptPath = path.resolve(process.argv[1]);
const requireFromScript = createRequire(scriptPath);
// Historical fixtures locked by the named existing tests, independent of the GraphStats call.
const FIXTURES = {
  ivy: { total: 29160, histogram: [1, 8, 48, 288, 1640, 7582, 15262, 4221, 110],
    metric: '120-degree corner turn, either direction; legacy csTimer R L D B notation.',
    test: 'tests/ivy_solver.test.ts', fixedArrayBytes: 2 * 58320 + 8 * (720 + 81) * 4 },
  '223': { total: 241920, histogram: [1, 8, 35, 157, 678, 2527, 7442, 17088, 31568, 44704, 47216, 49792, 29024, 11104, 576],
    metric: 'One token: U/U2/U-prime, D/D2/D-prime, R2 or F2; csTimer fixed middle-layer reference.',
    test: 'tests/cuboid223_solver.test.ts', fixedArrayBytes: 2 * 241920 + 4 * (40320 + 6) * 4 },
  skewb: { total: 3149280, histogram: [1, 8, 48, 288, 1728, 10248, 59304, 315198, 1225483, 1455856, 81028, 90],
    metric: '120-degree WCA corner turn, either direction; R U L B generators.',
    test: 'tests/skewb_solver.test.ts; Rust Skewb exact-histogram fixture', fixedArrayBytes: 9 * 3149280 + (8748 + 360) * 8 * 4 },
  sfl: { total: 3041280, histogram: [1, 12, 90, 584, 3301, 15536, 64935, 226464, 602629, 1027956, 861916, 230224, 7600, 32],
    metric: 'One R/L/U/D face turn by 90, 180 or 270 degrees; fixed edge references.',
    test: 'tests/superfloppy_solver.test.ts', fixedArrayBytes: 3 * 3041280 + 4 * (11880 + 256) * 4 },
} satisfies Record<ExistingEvent, { total: number; histogram: number[]; metric: string; test: string; fixedArrayBytes: number }>;
function checkMemory(phase: string): void {
  assert(process.memoryUsage().heapUsed <= MAX_HEAP_BYTES, `${phase}: live V8 heap exceeded 128 MiB`);
  assert(process.resourceUsage().maxRSS * 1024 <= MAX_RSS_BYTES, `${phase}: process RSS exceeded 512 MiB`);
}
const tokens = (algorithm: string): string[] => algorithm.trim().split(/\s+/).filter(Boolean);

async function loadExisting(event: ExistingEvent): Promise<Adapter> {
  if (event === 'ivy') {
    const engine = await import('@cuberoot/puzzle-solvers/ivy');
    return { stats: engine.ivyGraphStats, examples: () => engine.ivyExamplesByLength(1), solve: engine.solveIvy,
      apply: engine.ivyApply, reference: replayIvy, source: requireFromScript.resolve('@cuberoot/puzzle-solvers/ivy') };
  }
  if (event === '223') {
    const engine = await import('../lib/cuboid223-solver.ts');
    return { stats: engine.cuboid223GraphStats, examples: () => engine.cuboid223ExamplesByLength(1), solve: engine.solveCuboid223,
      apply: engine.cuboid223Apply, reference: replay223, source: 'core/packages/client/lib/cuboid223-solver.ts' };
  }
  if (event === 'sfl') {
    const engine = await import('../lib/superfloppy-solver.ts');
    return { stats: engine.superFloppyGraphStats, examples: () => engine.superFloppyExamplesByLength(1), solve: engine.solveSuperFloppy,
      apply: engine.superFloppyApply, reference: replaySuperFloppy, source: 'core/packages/client/lib/superfloppy-solver.ts' };
  }
  const engine = await import('@cuberoot/puzzle-solvers/skewb');
  return {
    stats: () => {
      const stats = engine.skewbGraphStats(), graph = engine.skewbGraph(), histogram: number[] = [];
      // Public histogram caps bins at the known diameter. Check the raw distance table too.
      for (const distance of graph.dist) {
        assert(distance !== 255, 'Skewb coordinate product contains unreachable states');
        histogram[distance] = (histogram[distance] ?? 0) + 1;
      }
      assert.deepEqual(histogram, stats.histogram); return { total: graph.dist.length, histogram };
    },
    examples: () => Object.fromEntries(FIXTURES.skewb.histogram.map((_, depth) => [depth,
      [depth === 0 ? '' : engine.generateSkewbByDistance(depth, depth, () => 0.5)]])),
    solve: scramble => engine.solveSkewbFacelet(engine.skewbFaceletFromMoves(scramble)),
    apply: engine.skewbFaceletFromMoves, reference: null, source: requireFromScript.resolve('@cuberoot/puzzle-solvers/skewb'),
  };
}
function atomicWrite(file: string, contents: string): void {
  const temporary = `${file}.${process.pid}.tmp`, fd = openSync(temporary, 'wx');
  try { writeFileSync(fd, contents); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, file);
}
async function main(): Promise<void> {
  const started = performance.now(), [eventArgument, outputArgument, ...extra] = process.argv.slice(2);
  assert(extra.length === 0 && ['ivy', '223', 'skewb', 'sfl', 'tetraminx', 'jingpyraminx', 'pyramorphix', 'pyramorphix-qtm', 'dino', 'half', 'lsemu', "offline-bic", "offline-ivy", "offline-223", "offline-sfl", "offline-133", "offline-8p", "offline-cm2", "offline-gear", "offline-ufo", "offline-dmd", "offline-pyraminx_duo", "lsemu-qtm", "roux-eolr-ac", "roux-eolr-mc", "roux-eodm", 'htr-dr', 'fr-htr', ...EXACT_DOWNLOAD_JOBS].includes(eventArgument) && outputArgument,
    'Usage: node --max-old-space-size=128 --import tsx SCRIPT EVENT OUTPUT.json');
  const event = eventArgument as Event, output = path.resolve(outputArgument);
  assert(output.endsWith('.json'), 'OUTPUT must end in .json');
  const csvPath = output.slice(0, -5) + '.csv';
  assert(!existsSync(output) && !existsSync(csvPath), 'Output exists; preserve it and choose a new path');
  const options = [...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' ');
  const limits = [...options.matchAll(/--max[-_]old[-_]space[-_]size(?:=|\s+)(\d+)/g)].map(match => Number(match[1]));
  assert(limits.length > 0 && limits.every(limit => limit > 0 && limit <= 128), 'Start with --max-old-space-size=128 or less');
  checkMemory('startup');
  const timingMs = { import: 0, graph: 0, examples: 0, solve: 0, verification: 0 };
  let result: Record<string, unknown>, histogram: number[], total: number;
  if (EXACT_DOWNLOAD_JOBS.includes(event as ExactDownloadJob)) {
    const repository = path.resolve(path.dirname(scriptPath), '../../../..');
    const checkpointDirectory = event === 'assets-dino-both'
      ? path.resolve(repository, '.local/small-puzzle-distributions-20261023/dino/dino-checkpoint')
      : output.slice(0, -5) + '-checkpoint';
    const prepared = await (await import('./prepare-exact-state-downloads.mts')).prepareExactDownloadJob(event as ExactDownloadJob, checkpointDirectory);
    const published = JSON.parse(readFileSync(path.resolve(path.dirname(scriptPath), '../app/[lang]/scramble/stats/_data/precomputed-exact-puzzles.json'), 'utf8'));
    const parts = [prepared, ...prepared.secondaryExports];
    // Validate every paired result before exposing either export. These jobs
    // never rewrite the original distribution or its provenance SHA.
    for (const part of parts) {
      assert.deepEqual(part.histogram, published.puzzles[part.event]?.histogram, `${part.event}: existing exact histogram changed`);
      assert.equal(part.total, published.puzzles[part.event].total);
    }
    timingMs.graph = prepared.preparationMs;
    const exportStarted = performance.now();
    const writer = await import('./export-exact-state-downloads.mts');
    const exports = parts.map(part => ({ event: part.event, total: part.total,
      resumeKey: part.allStates.resumeKey, originalReportSha256: published.puzzles[part.event].provenance.reportSha256,
      downloads: writer.writeExactStateDownloads(part.event, part.histogram, part.allStates) }));
    timingMs.examples = performance.now() - exportStarted;
    histogram = prepared.histogram; total = prepared.total;
    result = { event, puzzleEvent: prepared.event, assetOnly: true, total, godsNumber: histogram.length - 1,
      goalCount: published.puzzles[prepared.event].goalCount ?? 1, checkpointDirectory, exports,
      verification: { allHistogramsMatchedOriginalReports: true, resumableExports: true,
        sameProcessForPairedExports: true, originalDistributionsUnchanged: true },
      source: { method: 'Stream complete states from verified persistent distance coordinates', worker: scriptPath } };
  } else if (event === 'htr-dr' || event === 'fr-htr') {
    let phase = performance.now();
    const { enumerateFmcSubgoal } = await import('./fmc-goal-exact-distributions.mts');
    timingMs.import = performance.now() - phase;
    const computed = await enumerateFmcSubgoal(event, { nativeTablePath: output.slice(0, -5) + '.native.bin' });
    checkMemory(`${event} native quotient and independent proof`);
    histogram = [...computed.histogram]; total = computed.stateCount;
    Object.assign(timingMs, computed.timingMs);
    phase = performance.now();
    const downloads = (await import('./export-exact-state-downloads.mts')).writeExactStateDownloads(event, histogram, computed.allStates);
    Object.assign(timingMs, { downloads: performance.now() - phase });
    const { allStates: _stream, ...serializable } = computed;
    result = { ...serializable, event, puzzleEvent: event, total, downloads, recomputedExistingDistribution: false,
      examples: computed.examples.map(example => ({ ...example, depth: example.distance })),
      source: { method: 'Complete target-coset distribution from existing Rust solver with independent physical graph proof', worker: scriptPath,
        engine: 'scripts/fmc-goal-exact-distributions.mts', nativeEngine: 'solver/src/bin/dist_htr_fr.rs',
        nativeModel: event === 'htr-dr' ? 'solver/src/htr_solver.rs' : 'solver/src/fr_solver.rs' } };
  } else if (event.startsWith('offline-') || ['lsemu-qtm', 'roux-eolr-ac', 'roux-eolr-mc', 'roux-eodm'].includes(event)) {
    const phase = performance.now();
    const isLegacy = event.startsWith('offline-'), puzzleEvent = isLegacy ? event.slice(8) : event;
    const computed = isLegacy
      ? await (await import('./legacy-exact-offline.mts')).enumerateLegacyOffline(puzzleEvent)
      : await (await import('./roux-goal-exact-distributions.mts')).enumerateRouxGoal(puzzleEvent as Parameters<typeof import('./roux-goal-exact-distributions.mts').enumerateRouxGoal>[0]);
    histogram = [...computed.histogram]; total = computed.stateCount;
    let downloads = 'downloads' in computed ? computed.downloads : undefined;
    if ('allStates' in computed) downloads = (await import('./export-exact-state-downloads.mts')).writeExactStateDownloads(puzzleEvent, histogram, computed.allStates);
    const { allStates: _stream, ...serializable } = computed as typeof computed & { allStates?: unknown };
    Object.assign(timingMs, computed.timingMs);
    timingMs.verification += performance.now() - phase - Object.values(computed.timingMs).reduce((a, b) => a + b, 0);
    result = { ...serializable, event, puzzleEvent, total, downloads, recomputedExistingDistribution: isLegacy,
      examples: computed.examples.map(example => ({ ...example, depth: example.distance })),
      source: { method: isLegacy ? 'Established exact graph with offline full-state export' : 'Complete restricted-group distances to a reviewed training goal', worker: scriptPath } };
  } else if (event === 'tetraminx' || event === 'jingpyraminx' || event === 'pyramorphix' || event === 'pyramorphix-qtm' || event === 'dino' || event === 'half' || event === 'lsemu') {
    const phase = performance.now();
    const enumerate = event === 'tetraminx'
      ? (await import('./tetraminx-exact-distribution.mts')).enumerateTetraminx
      : event === 'jingpyraminx' ? (await import('./jing-pyraminx-exact-distribution.mts')).enumerateJingPyraminx
      : event === 'pyramorphix' ? (await import('./pyramorphix-exact-distribution.mts')).enumeratePyramorphix
      : event === 'pyramorphix-qtm' ? (await import('./pyramorphix-exact-distribution.mts')).enumeratePyramorphixQtm
      : event === 'dino' ? () => import('./dino-exact-distribution.mts').then(module => module.enumerateDino({ checkpointDirectory: output.slice(0, -5) + '-checkpoint' }))
      : event === 'half' ? (await import('./restricted333-exact-distribution.mts')).enumerateHalfTurnCube
      : (await import('./restricted333-exact-distribution.mts')).enumerateLseMu;
    timingMs.import = performance.now() - phase;
    const computed = await enumerate();
    checkMemory(`${event} complete`);
    histogram = [...computed.histogram]; total = computed.stateCount;
    Object.assign(timingMs, computed.timingMs);
    result = { ...computed, event, total, recomputedExistingDistribution: false,
      examples: computed.examples.map(example => ({ ...example, depth: example.distance })),
      source: { method: 'Full reachable-state BFS', worker: scriptPath,
        engine: event === 'tetraminx' ? 'scripts/tetraminx-exact-distribution.mts' : event === 'jingpyraminx'
          ? 'scripts/jing-pyraminx-exact-distribution.mts' : event === 'dino' ? 'scripts/dino-exact-distribution.mts'
          : event === 'half' || event === 'lsemu' ? 'scripts/restricted333-exact-distribution.mts' : 'scripts/pyramorphix-exact-distribution.mts' } };
  } else {
    const fixture = FIXTURES[event as ExistingEvent];
    let phase = performance.now();
    const adapter = await loadExisting(event as ExistingEvent);
    timingMs.import = performance.now() - phase; checkMemory('module import');
    phase = performance.now();
    const computed = adapter.stats();
    timingMs.graph = performance.now() - phase; checkMemory('full graph');
    histogram = [...computed.histogram]; total = computed.total;
    assert.equal(total, fixture.total); assert.deepEqual(histogram, fixture.histogram, `${event}: historical histogram changed`);
    phase = performance.now();
    const byDepth: Record<number, string[]> = { ...adapter.examples(), 0: [''] };
    timingMs.examples = performance.now() - phase; checkMemory('examples');
    phase = performance.now();
    const examples: Example[] = histogram.flatMap((count, depth) => {
      if (!count) return [];
      const scramble = byDepth[depth]?.[0]; assert.notEqual(scramble, undefined, `Missing depth ${depth}`);
      const solved = adapter.solve(scramble);
      assert.equal(solved.length, depth); assert.equal(tokens(scramble).length, depth); assert.equal(tokens(solved.solution).length, depth);
      return [{ depth, scramble, solution: solved.solution, length: solved.length }];
    });
    timingMs.solve = performance.now() - phase; phase = performance.now();
    if (adapter.reference) {
      const solved = adapter.reference('');
      for (const example of examples) {
        assert.deepEqual(adapter.reference(example.scramble), adapter.apply(example.scramble), 'Independent source-state replay mismatch');
        assert.deepEqual(adapter.reference(`${example.scramble} ${example.solution}`), solved, 'Independent witness replay did not solve');
      }
    } else {
      const { puzzles } = await import('cubing/puzzles'), kpuzzle = await puzzles.skewb.kpuzzle(), solved = kpuzzle.defaultPattern();
      for (const example of examples) {
        const state = solved.applyAlg(example.scramble);
        if (example.depth > 0) assert.notDeepEqual(state.patternData, solved.patternData);
        assert.deepEqual(state.applyAlg(example.solution).patternData, solved.patternData, 'Independent cubing Skewb witness replay did not solve');
      }
    }
    timingMs.verification = performance.now() - phase; checkMemory('independent witnesses');
    result = { event, total, godsNumber: histogram.length - 1, metric: fixture.metric, examples, recomputedExistingDistribution: true,
      verification: { fullSpaceEnumerated: true, expectedStateCount: fixture.total, historicalHistogramMatched: true,
        exampleBinCoverage: 'Every nonempty bin, including solved', independentlyReplayedExamples: examples.length,
        independentReplay: event === 'skewb' ? 'cubing/puzzles Skewb KPuzzle' : `${fixture.test}: short-sequence reference model`,
        independentFullSpaceBfsThisRun: false,
        boundary: 'Exact distances use the existing complete BFS. Historical bins and independent witnesses checked; no second full-space BFS in this run.' },
      memoryPlan: { fixedArrayBytes: fixture.fixedArrayBytes,
        note: 'Excludes runtime and JS frontier capacity overhead. Existing finite state space bounds frontier entries; external guard enforces total RSS.' },
      source: { method: 'Existing complete BFS recomputed in a fresh process', worker: scriptPath, engine: adapter.source, fixture: fixture.test } };
  }
  assert(histogram.length > 0 && histogram[0] === (result.goalCount ?? 1) && histogram.at(-1)! > 0);
  assert(histogram.every(count => Number.isSafeInteger(count) && count >= 0));
  assert.equal(histogram.reduce((sum, count) => sum + count, 0), total);
  const physicalWeight = result.quotient === true ? Number(result.physicalStatesPerCoordinate) : undefined;
  if (physicalWeight !== undefined) assert(Number.isSafeInteger(physicalWeight) && physicalWeight > 0);
  const csv = `depth,count,probability${physicalWeight === undefined ? '' : ',physical_count'}\n`
    + histogram.map((count, depth) => `${depth},${count},${count / total}${physicalWeight === undefined ? '' : `,${count * physicalWeight}`}`).join('\n') + '\n';
  checkMemory('before persistence'); mkdirSync(path.dirname(output), { recursive: true }); atomicWrite(csvPath, csv);
  const report = { ...result, completed: true, generatedAt: new Date().toISOString(), elapsedMs: performance.now() - started,
    timingMs, totalComputeMs: Object.entries(timingMs).reduce((sum, [phase, ms]) => sum + (phase === 'import' ? 0 : ms), 0),
    timingBoundary: 'elapsedMs starts inside main and includes imports, computation, verification and CSV write; excludes Node startup and final JSON persistence.',
    maxRssBytes: process.resourceUsage().maxRSS * 1024, histogram,
    limits: { maxOldSpaceMiB: Math.min(...limits), maxLiveHeapBytes: MAX_HEAP_BYTES, maxRssBytes: MAX_RSS_BYTES },
    csv: { path: path.basename(csvPath), sha256: createHash('sha256').update(csv).digest('hex') } };
  atomicWrite(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ event, completed: true, total, godsNumber: histogram.length - 1, elapsedMs: report.elapsedMs, maxRssBytes: report.maxRssBytes, output }));
}
main().catch(error => {
  console.error(JSON.stringify({ completed: false, error: error instanceof Error ? error.message : String(error), maxRssBytes: process.resourceUsage().maxRSS * 1024 }));
  process.exitCode = 1;
});
