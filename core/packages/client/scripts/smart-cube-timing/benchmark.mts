import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { MoveClock, moveClockElapsed } from '@cuberoot/shared/smart-cube/move-clock';
import { SmartCubeAttemptProducer } from '@cuberoot/shared/timer/smart-cube-attempt';
import { initialTimerMachineState, transitionTimer } from '@cuberoot/shared/timer/machine';
import { CSTIMER_COMMIT, CSTIMER_FILES, loadCstimer, sha256 } from './cstimer.mts';
import { eventsFor, MONOTONIC_ORIGIN_MS, scenarios, WALL_ORIGIN_MS, type Scenario, type TimingEvent } from './scenarios.mts';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const timerConfig = { inspectionSec: 0 };

export function runCurrent(events: TimingEvent[], scenario: Scenario) {
  const clock = new MoveClock();
  const recording = new SmartCubeAttemptProducer();
  let timer = initialTimerMachineState();
  let previous: { deviceMs: number; mappedMs: number; rate: number } | null = null;
  let firstMapped = 0, firstArrival = 0, startClampMs = 0, stopClampMs = 0, mappedSpanMs = 0;
  let firstDevice: number | null = null, timeMs: number | null = null, rawDeviceSpanMs: number | null = null;
  const shifts: Array<{ realMs: number; shiftMs: number; inSolve: boolean }> = [];
  const mapped: number[] = [];
  const rates: number[] = [];
  for (const event of events) {
    const nowMs = MONOTONIC_ORIGIN_MS + event.arrivalMs;
    const stamp = clock.stamp(event.deviceMs ?? undefined, nowMs);
    mapped.push(stamp);
    rates.push(clock.clockRate);
    if (previous && event.deviceMs !== null) {
      // A calibrated interval is not an origin shift. Only the residual after
      // applying the rate known before this notification is a discontinuity.
      const shiftMs = stamp - (previous.mappedMs + (event.deviceMs - previous.deviceMs) * previous.rate);
      if (Math.abs(shiftMs) > 1e-6) shifts.push({ realMs: event.realMs, shiftMs, inSolve: event.realMs > scenario.preRollMs });
    }
    previous = event.deviceMs === null ? null : { deviceMs: event.deviceMs, mappedMs: stamp, rate: clock.clockRate };
    if (event.realMs === scenario.preRollMs) {
      firstMapped = stamp; firstArrival = event.arrivalMs; firstDevice = event.deviceMs;
      timer = transitionTimer(timer, { type: 'arm-from-cube', nowMs, atMs: stamp }, timerConfig).state;
      const started = transitionTimer(timer, { type: 'start-from-cube', nowMs, atMs: stamp, clock: clock.sample }, timerConfig);
      assert.equal(started.accepted, true, `${scenario.id}: start rejected`);
      timer = started.state;
      startClampMs = timer.startedAtMs! - stamp;
      recording.begin(timer.startedAtMs!, undefined, undefined, timer.cubeStart);
    }
    if (event.inSolve) recording.recordMove('R', stamp, clock.sample);
    if (event === events.at(-1)) {
      const stopped = transitionTimer(timer, { type: 'stop-from-cube', nowMs, atMs: stamp, clock: clock.sample }, timerConfig);
      assert.equal(stopped.accepted, true, `${scenario.id}: stop rejected`);
      timeMs = stopped.solve!.timeMs;
      mappedSpanMs = stamp - firstMapped;
      stopClampMs = moveClockElapsed(timer.cubeStart?.sample, clock.sample) === null ? Math.min(nowMs, stamp) - stamp : 0;
      rawDeviceSpanMs = firstDevice === null || event.deviceMs === null ? null : event.deviceMs - firstDevice;
    }
  }
  assert.notEqual(timeMs, null);
  const savedMoves = recording.finish().moves;
  assert.ok(Math.abs(savedMoves.at(-1)!.ts - timeMs!) < 1e-7, `${scenario.id}: recording and saved duration diverge`);
  return {
    timeMs: timeMs!, rawDeviceSpanMs, mappedSpanMs, startClampMs, stopClampMs,
    arrivalSpanMs: events.at(-1)!.arrivalMs - firstArrival,
    reanchors: shifts.length, inSolveReanchors: shifts.filter(shift => shift.inSolve).length,
    shifts, mapped, rates, savedMoves,
  };
}

type Oracle = Awaited<ReturnType<typeof loadCstimer>>;
export function runCase(scenario: Scenario, oracle: Oracle) {
  const events = eventsFor(scenario);
  const current = runCurrent(events, scenario);
  const solveEvents = events.filter(event => event.inSolve);
  const wallOrigin = scenario.wallOriginMs ?? WALL_ORIGIN_MS;
  // Older moves in a batch have no independent local observation. Untimed
  // devices fall back to host time. Driver decoding itself is outside this suite.
  const reference = oracle.run(solveEvents.map(event => ({
    row: ['R ', event.deviceMs ?? wallOrigin + event.arrivalMs,
      event.localObservationMs === null ? null : wallOrigin + event.localObservationMs],
    arrivalMs: wallOrigin + event.arrivalMs,
  })));
  const summary = {
    ...scenario, moves: solveEvents.length, inputSha256: sha256(JSON.stringify(events)),
    rawDeviceSpanMs: current.rawDeviceSpanMs, arrivalSpanMs: current.arrivalSpanMs,
    mappedSpanMs: current.mappedSpanMs, currentMs: current.timeMs, cstimerMs: reference.timeMs,
    currentErrorMs: current.timeMs - scenario.durationMs, cstimerErrorMs: reference.timeMs - scenario.durationMs,
    cstimerSlope: reference.slope, startClampMs: current.startClampMs, stopClampMs: current.stopClampMs,
    reanchors: current.reanchors, inSolveReanchors: current.inSolveReanchors,
    finalClockRate: current.rates.at(-1)!,
    savedMoveEndMs: current.savedMoves.at(-1)!.ts,
  };
  return { summary, events, current, reference };
}

function verifyHarness(oracle: Oracle): string[] {
  const control: Scenario = { id: 'control', family: 'drift', drift: 0, durationMs: 10000,
    preRollMs: 0, profile: 'constant', seed: 1 };
  const clean = runCase(control, oracle);
  assert.equal(clean.summary.currentMs, 10000);
  assert.equal(clean.summary.cstimerMs, 10000);
  const shifted = runCase({ ...control, drift: -0.007 }, oracle);
  assert.equal(shifted.summary.cstimerMs, 10000);
  assert.ok(Math.abs(shifted.summary.currentErrorMs) < 0.1, 'cold first solve must use the final calibrated rate');
  // A tsLinearFix identity stub cannot pass this control.
  assert.notEqual(shifted.reference.correctedTimesMs.at(-1), shifted.summary.rawDeviceSpanMs);
  assert.equal(runCase({ ...control, profile: 'latency-ramp' }, oracle).summary.cstimerMs, 10100);
  const fallback = runCase({ ...control, profile: 'no-device-clock', terminalExtraMs: 100 }, oracle);
  assert.equal(fallback.summary.currentMs, 10100);
  assert.equal(fallback.summary.cstimerMs, 10100);
  const batched = runCase({ ...control, profile: 'batch-four' }, oracle);
  assert.equal(batched.summary.cstimerMs, 10000);
  assert.equal(batched.summary.currentMs, 10000);
  // Analytic input check. Do not require CubeRoot to keep its known timing bug:
  // a future correction must be able to improve without rewriting the harness.
  assert.equal(batched.summary.arrivalSpanMs, 9700);
  const input = [{ row: ['R ', 1000, 10000] as [string, number, number], arrivalMs: 10000 },
    { row: ['R ', 2000, 11000] as [string, number, number], arrivalMs: 11000 }];
  const original = structuredClone(input);
  assert.equal(oracle.run(input).timeMs, 1000);
  assert.deepEqual(input, original);
  const translated = scenarios().filter(scenario => scenario.family === 'numeric-origin').map(scenario => {
    const events = eventsFor(scenario).filter(event => event.inSolve);
    return events.map(event => [event.deviceMs! - events[0].deviceMs!, event.arrivalMs - events[0].arrivalMs]);
  });
  for (const intervals of translated) assert.deepEqual(intervals, translated[0]);
  const jitter = { ...control, profile: 'jitter' as const };
  assert.deepEqual(eventsFor(jitter), eventsFor(jitter));
  assert.notDeepEqual(eventsFor(jitter), eventsFor({ ...jitter, seed: 2 }));
  const late = runCase({ ...control, terminalExtraMs: 2001 }, oracle);
  assert.equal(late.summary.currentMs, 10000);
  assert.equal(late.summary.inSolveReanchors, 0);
  const aged = runCase({ ...control, drift: -0.007, preRollMs: 280000 }, oracle);
  assert.ok(Math.abs(aged.summary.currentErrorMs) < 0.01, 'learned rate must survive the former 2-second threshold');
  assert.equal(aged.summary.inSolveReanchors, 0);
  return ['zero-drift exact duration', 'real correction differs from identity stub',
    'latency ramp: independently known 100 ms bias', 'untimed fallback uses arrival interval',
    'batch observation semantics', 'oracle does not mutate caller input',
    'actual csTimer callback emits exactly one saved solve per case',
    'origin translations preserve every device and arrival interval', 'seeded input is reproducible and varies across seeds',
    'late terminal packet cannot add its latency to the saved solve', 'learned slow clock crosses former resync threshold without a jump',
    'cold first solve uses retrospective interval calibration', 'batched first moves do not lose duration to a host stop clamp'];
}

type Summary = ReturnType<typeof runCase>['summary'];
type ComparedSummary = Summary & { beforeMs: number; beforeErrorMs: number; beforeInSolveReanchors: number;
  previousMs: number; previousErrorMs: number; previousInSolveReanchors: number };
interface Baseline {
  metadata: { cuberootCommit: string; corpusSha256: string; cstimerCommit: string;
    cuberootSourceHashes: Record<string, string>; cstimerFileHashes: unknown; cstimerFunctionHashes: unknown };
  cases: Array<Pick<Summary, 'id' | 'inputSha256' | 'durationMs' | 'currentMs' | 'currentErrorMs' | 'cstimerMs' | 'inSolveReanchors'>>;
}

function statistics(rows: ComparedSummary[], key: 'beforeErrorMs' | 'previousErrorMs' | 'currentErrorMs' | 'cstimerErrorMs') {
  const values = rows.map(row => row[key]);
  const abs = values.map(Math.abs).sort((a, b) => a - b);
  return { cases: rows.length, meanSignedErrorMs: values.reduce((a, b) => a + b, 0) / values.length,
    p95AbsoluteErrorMs: abs[Math.ceil(abs.length * 0.95) - 1], maxAbsoluteErrorMs: abs.at(-1)!,
    casesWithin10Ms: abs.filter(value => value <= 10).length };
}

function comparison(rows: ComparedSummary[], key: 'beforeErrorMs' | 'previousErrorMs' | 'cstimerErrorMs') {
  const changes = rows.map(row => Math.abs(row.currentErrorMs) - Math.abs(row[key]));
  return { toleranceMs: 1, improved: changes.filter(delta => delta < -1).length,
    regressed: changes.filter(delta => delta > 1).length, similar: changes.filter(delta => Math.abs(delta) <= 1).length };
}

function report(rows: ComparedSummary[], commit: string): string {
  const selected = rows.filter(row => (row.profile === 'constant' && row.durationMs === 10000 && row.family === 'drift')
    || row.id === 'age/-0.007/280000' || row.id === 'age/0.007/280000'
    || row.family === 'threshold' || row.family === 'fallback' || row.family === 'numeric-origin'
    || (['latency-ramp', 'batch-four'].includes(row.profile) && row.drift === 0 && row.durationMs === 10000));
  const lines = ['# Smart-cube software timing benchmark', '',
    `CubeRoot: \`${commit}\`; csTimer: \`${CSTIMER_COMMIT}\`.`,
    `${rows.length} deterministic synthetic cases. Full hashes and harness checks: results.json.`, '',
    'Timing accuracy, not execution speed. No physical cube, BLE stack, firmware, display, or database is exercised.',
    'Both timers start armed, inspection disabled, one phase. Truth is the interval from first reported turn to final reported turn.',
    'Original and previous fix are frozen 2026-11-06 result artifacts, checked case-by-case against identical input hashes and csTimer outputs. Their source hashes are retained in results.json.',
    'Current executes MoveClock, the shared timer machine and the production attempt recorder. Every saved final-move time must equal the saved score. csTimer executes unmodified tsLinearFit, tsApplyFixes, tsLinearFix, giikerCallback and isGiiSolved from hash-locked source.',
    'Only UI, puzzle-completion signals, timer storage accessors and non-timing hooks are stubbed. Physical-time truth is not passed to either estimator.', '',
    '## Selected cases', '',
    '| Case | Truth ms | Original ms | Previous fix ms | Current ms | csTimer ms | Original reanchors | Current reanchors |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...selected.map(r => `| ${r.id} | ${r.durationMs} | ${r.beforeMs} | ${r.previousMs.toFixed(3)} | ${r.currentMs.toFixed(3)} | ${r.cstimerMs} | ${r.beforeInSolveReanchors} | ${r.inSolveReanchors} |`), '',
    '## By scenario family', '',
    '| Family | Algorithm | Cases | Mean signed error ms | P95 absolute error ms | Max absolute error ms | Within 10 ms |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |'];
  for (const family of ['all', ...new Set(rows.map(row => row.family))]) {
    for (const [name, key] of [['Original', 'beforeErrorMs'], ['Previous fix', 'previousErrorMs'], ['Current', 'currentErrorMs'], ['csTimer', 'cstimerErrorMs']] as const) {
      const s = statistics(family === 'all' ? rows : rows.filter(row => row.family === family), key);
      lines.push(`| ${family} | ${name} | ${s.cases} | ${s.meanSignedErrorMs.toFixed(3)} | ${s.p95AbsoluteErrorMs.toFixed(3)} | ${s.maxAbsoluteErrorMs.toFixed(3)} | ${s.casesWithin10Ms} |`);
    }
  }
  const regressions = rows.filter(row => Math.abs(row.previousErrorMs) - Math.abs(row.beforeErrorMs) > 1);
  const changed = comparison(rows, 'previousErrorMs');
  lines.push('', '## Full current-vs-previous comparison', '',
    `Absolute-error change >1 ms: ${changed.improved} improved, ${changed.regressed} regressed, ${changed.similar} similar.`,
    'The following table includes every regression, including cases outside the earlier set of 18.', '',
    '| Case | Previous error ms | Current error ms | csTimer error ms |',
    '| --- | ---: | ---: | ---: |',
    ...rows.filter(r => Math.abs(r.currentErrorMs) - Math.abs(r.previousErrorMs) > 1).map(r =>
      `| ${r.id} | ${r.previousErrorMs.toFixed(3)} | ${r.currentErrorMs.toFixed(3)} | ${r.cstimerErrorMs.toFixed(3)} |`));
  lines.push('', '## The 18 previous regressions', '',
    'Rows selected only by the frozen previous-vs-original comparison (>1 ms absolute-error increase).', '',
    '| Case | Original error ms | Previous error ms | Current error ms | csTimer error ms |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...regressions.map(r => `| ${r.id} | ${r.beforeErrorMs.toFixed(3)} | ${r.previousErrorMs.toFixed(3)} | ${r.currentErrorMs.toFixed(3)} | ${r.cstimerErrorMs.toFixed(3)} |`));
  lines.push('', '## Interpretation and limits', '',
    '- Current keeps continuous live timestamps, but evaluates the entire saved device interval using the final learned rate. The attempt recorder uses the same rate. The first packet arrival is no longer subtracted from a separately clamped absolute stop time.',
    '- The calibration window grows from 128 to 512 independent observations to reduce jitter-induced rate error. Short solves with insufficient observations still use device rate 1; a new connection is not instantly calibrated.',
    '- Re-anchoring now means a residual discontinuity after subtracting the interval at the previously known rate; changing rate alone is not a re-anchor. Traces include every rate and start/stop clamp.',
    '- Session-age cases retain one MoveClock through all pre-roll moves. csTimer fits only the solve, as its real timer callback does.',
    '- Threshold cases add terminal latency of 1999, 2000, 2001 and 2500 ms. A strict greater-than threshold is distinct from rate drift.',
    '- Both algorithms can absorb smoothly time-correlated transport latency into the fitted slope. Clock-rate error and a linear latency ramp cannot be uniquely separated from these observations. No profile names, true times or brand-specific constants enter calibration. csTimer is a reference implementation, not ground truth.',
    '- Numeric-origin cases translate device/local clock origins while keeping the same physical intervals. They expose numerical cancellation in the original uncentered sums; they do not model a wrap.',
    '- Batch cases expose only the newest move as a local observation to csTimer. MoveClock retains the newest equal-arrival observation and fits completed batches; immutable per-move samples preserve device intervals across host anchor offsets.',
    '- Untimed-device cases use host arrival time. Device drift cannot be identified without a device clock.',
    '- Eight fixed jitter seeds are synthetic cases, not device samples or confidence intervals. The 10 ms count is descriptive, not an acceptance standard.',
    '- Not covered: protocol decoding, missing/estimated turns, counter rollover, mid-solve disconnection, state-only stop recovery.', '',
    'Artifacts: results.json (provenance and outcomes), results.csv (comparison), traces.jsonl (all inputs, mapped/corrected times and anchor shifts).', '');
  return lines.join('\n');
}

async function main() {
  const { values } = parseArgs({ options: { offline: { type: 'boolean', default: false },
    out: { type: 'string' }, cache: { type: 'string' }, baseline: { type: 'string' }, previous: { type: 'string' }, help: { type: 'boolean' } } });
  if (values.help) {
    console.log('pnpm --filter @cuberoot/client bench:smart-cube-timing [--offline] [--out PATH] [--cache PATH] [--baseline PATH] [--previous PATH]');
    return;
  }
  const started = performance.now(), generatedAt = new Date().toISOString();
  const artifactRoot = join(repoRoot, '.local-data/smart-cube-timing');
  const cache = values.cache ? resolve(values.cache) : join(artifactRoot, 'upstream');
  const output = values.out ? resolve(values.out) : join(artifactRoot, 'runs', `${generatedAt.replaceAll(':', '-')}-${process.pid}`);
  const oracle = await loadCstimer(cache, values.offline);
  const harnessChecks = verifyHarness(oracle);
  const baselinePath = values.baseline ? resolve(values.baseline) : join(repoRoot, 'docs/benchmarks/smart-cube-timing-2026-11-06.json');
  const baselineBytes = readFileSync(baselinePath);
  const baseline = JSON.parse(baselineBytes.toString()) as Baseline;
  assert.equal(baseline.metadata.cstimerCommit, CSTIMER_COMMIT, 'baseline csTimer revision changed');
  assert.deepEqual(baseline.metadata.cstimerFileHashes, CSTIMER_FILES, 'baseline csTimer source changed');
  assert.deepEqual(baseline.metadata.cstimerFunctionHashes, oracle.functionHashes, 'baseline csTimer functions changed');
  const beforeById = new Map(baseline.cases.map(row => [row.id, row]));
  assert.equal(beforeById.size, baseline.cases.length, 'duplicate baseline case IDs');
  assert.equal(beforeById.size, scenarios().length, 'baseline corpus size changed');
  const previousPath = values.previous ? resolve(values.previous) : join(repoRoot, 'docs/benchmarks/smart-cube-timing-fix-2026-11-06.json');
  const previousBytes = readFileSync(previousPath);
  const previous = JSON.parse(previousBytes.toString()) as Baseline;
  assert.equal(previous.metadata.corpusSha256, baseline.metadata.corpusSha256, 'previous fix corpus changed');
  assert.equal(previous.metadata.cstimerCommit, CSTIMER_COMMIT, 'previous fix csTimer revision changed');
  assert.deepEqual(previous.metadata.cstimerFileHashes, CSTIMER_FILES, 'previous fix csTimer source changed');
  assert.deepEqual(previous.metadata.cstimerFunctionHashes, oracle.functionHashes, 'previous fix csTimer functions changed');
  const previousById = new Map(previous.cases.map(row => [row.id, row]));
  assert.equal(previousById.size, previous.cases.length, 'duplicate previous fix case IDs');
  assert.equal(previousById.size, beforeById.size, 'previous fix corpus size changed');
  mkdirSync(output, { recursive: true });
  const trace = openSync(join(output, 'traces.jsonl'), 'wx');
  const rows: ComparedSummary[] = [];
  try {
    for (const scenario of scenarios()) {
      const result = runCase(scenario, oracle);
      const before = beforeById.get(scenario.id);
      const prior = previousById.get(scenario.id);
      assert.ok(before, `missing baseline: ${scenario.id}`);
      assert.ok(prior, `missing previous fix: ${scenario.id}`);
      assert.equal(before.inputSha256, result.summary.inputSha256, `${scenario.id}: inputs changed`);
      assert.equal(before.durationMs, result.summary.durationMs, `${scenario.id}: truth changed`);
      assert.equal(before.cstimerMs, result.summary.cstimerMs, `${scenario.id}: csTimer output changed`);
      assert.equal(before.currentErrorMs, before.currentMs - before.durationMs, `${scenario.id}: inconsistent baseline`);
      assert.equal(prior.inputSha256, result.summary.inputSha256, `${scenario.id}: previous fix inputs changed`);
      assert.equal(prior.durationMs, result.summary.durationMs, `${scenario.id}: previous fix truth changed`);
      assert.equal(prior.cstimerMs, result.summary.cstimerMs, `${scenario.id}: previous fix csTimer output changed`);
      assert.equal(prior.currentErrorMs, prior.currentMs - prior.durationMs, `${scenario.id}: inconsistent previous fix`);
      rows.push({ ...result.summary, beforeMs: before.currentMs, beforeErrorMs: before.currentErrorMs,
        beforeInSolveReanchors: before.inSolveReanchors,
        previousMs: prior.currentMs, previousErrorMs: prior.currentErrorMs, previousInSolveReanchors: prior.inSolveReanchors });
      writeSync(trace, JSON.stringify(result) + '\n');
    }
  } finally { closeSync(trace); }
  // Resolve source fingerprints through public exports instead of package paths.
  const sourceUrls = [
    import.meta.resolve('@cuberoot/shared/smart-cube/move-clock'),
    import.meta.resolve('@cuberoot/shared/timer/machine'),
    import.meta.resolve('@cuberoot/shared/timer/smart-cube-attempt'),
    import.meta.resolve('@cuberoot/shared/timer/smart-cube-move-recorder'),
    new URL('../../tests/_cstimer_sandbox.ts', import.meta.url).href,
    ...['benchmark.mts', 'cstimer.mts', 'scenarios.mts'].map(file => new URL(file, import.meta.url).href),
  ];
  const metadata = {
    generatedAt, node: process.version,
    cuberootCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8', timeout: 5000 }).trim(),
    cuberootSourceHashes: Object.fromEntries(sourceUrls.map(url => [fileURLToPath(url).slice(repoRoot.length), sha256(readFileSync(new URL(url)))])),
    cstimerCommit: CSTIMER_COMMIT, cstimerFileHashes: CSTIMER_FILES, cstimerFunctionHashes: oracle.functionHashes,
    baseline: { path: baselinePath.startsWith(repoRoot) ? baselinePath.slice(repoRoot.length) : baselinePath,
      sha256: sha256(baselineBytes), ...baseline.metadata },
    previousFix: { path: previousPath.startsWith(repoRoot) ? previousPath.slice(repoRoot.length) : previousPath,
      sha256: sha256(previousBytes), ...previous.metadata },
    harnessChecks, clockOrigins: { monotonicMs: MONOTONIC_ORIGIN_MS, wallMs: WALL_ORIGIN_MS },
    durationMs: Math.round(performance.now() - started), maxRssKiB: process.resourceUsage().maxRSS,
    corpusSha256: sha256(JSON.stringify(rows.map(row => [row.id, row.inputSha256]))),
    scope: 'synthetic normalized callbacks; no hardware, UI, protocol decoding or persistence',
  };
  assert.equal(metadata.corpusSha256, baseline.metadata.corpusSha256, 'baseline corpus order/hash changed');
  harnessChecks.push('all original and previous-fix IDs, truths and input hashes unchanged', 'all csTimer source/function hashes and 441 saved results unchanged',
    'every saved final move agrees with the saved score');
  const groups = Object.fromEntries([...new Set(rows.map(row => row.family))].map(family => {
    const group = rows.filter(row => row.family === family);
    return [family, { before: statistics(group, 'beforeErrorMs'), previous: statistics(group, 'previousErrorMs'), current: statistics(group, 'currentErrorMs'), cstimer: statistics(group, 'cstimerErrorMs') }];
  }));
  const overall = { before: statistics(rows, 'beforeErrorMs'), previous: statistics(rows, 'previousErrorMs'), current: statistics(rows, 'currentErrorMs'), cstimer: statistics(rows, 'cstimerErrorMs') };
  const comparisons = { original: comparison(rows, 'beforeErrorMs'), previous: comparison(rows, 'previousErrorMs'), cstimer: comparison(rows, 'cstimerErrorMs') };
  writeFileSync(join(output, 'results.json'), JSON.stringify({ metadata, overall, groups, comparisons, cases: rows }, null, 2) + '\n');
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))] as Array<keyof ComparedSummary>;
  writeFileSync(join(output, 'results.csv'), [columns.join(','), ...rows.map(row => columns.map(key =>
    row[key] === null || row[key] === undefined ? '' : JSON.stringify(row[key])).join(','))].join('\n') + '\n');
  writeFileSync(join(output, 'report.md'), report(rows, metadata.cuberootCommit));
  console.log(JSON.stringify({ cases: rows.length, harnessChecks: harnessChecks.length,
    durationMs: metadata.durationMs, maxRssKiB: metadata.maxRssKiB, corpusSha256: metadata.corpusSha256, output, groups }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
