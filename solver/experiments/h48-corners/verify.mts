/** Verify saved benchmark output only: never starts a solver or loads H10. */
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const modes = ['original', 'baseline', 'candidate'] as const;
type Mode = typeof modes[number];
type Row = { id: string; index: number; run: number; mode: Mode; length: number; solution: string; seconds: number; nodes: number; lookups: number; fallbacks: number; cornerLookups: number; cornerPrunes: number; faceCuts?: number; bpmxCuts?: number; bpmxSkipped?: number; recursiveCuts?: number; verified: boolean; stats: number[] };
type Case = { id: string; scramble: string; htm?: number };
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
// Capture the loaded verifier, even if the working file is edited during a run.
const verifierSha256 = sha(readFileSync(fileURLToPath(import.meta.url)));
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw Error(message); }
function nonnegative(value: unknown) { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
function integer(value: unknown) { return nonnegative(value) && Number.isSafeInteger(value); }
function atomic(path: string, value: unknown) {
  const fd = openSync(path + '.new', 'w');
  try { writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fsyncSync(fd); }
  finally { closeSync(fd); }
  renameSync(path + '.new', path);
}
function rows(path: string): Row[] {
  const text = readFileSync(path, 'utf8');
  assert(text.endsWith('\n'), `Incomplete final output line: ${path}`);
  return text.trimEnd().split('\n').map((line, index) => {
    assert(line.length > 0, `Empty output line ${index + 1}: ${path}`);
    return JSON.parse(line);
  });
}
function totals(selected: Row[]) {
  const sum = (key: 'seconds' | 'nodes' | 'lookups' | 'fallbacks' | 'cornerLookups' | 'cornerPrunes' | 'faceCuts' | 'bpmxCuts' | 'bpmxSkipped' | 'recursiveCuts') => {
    const total = selected.reduce((n, row) => n + (row[key] ?? 0), 0);
    assert(nonnegative(total) && (key === 'seconds' || integer(total)), `Invalid aggregate ${key}`);
    return total;
  };
  return { cases: selected.length, seconds: sum('seconds'), nodes: sum('nodes'), lookups: sum('lookups'), fallbacks: sum('fallbacks'), cornerLookups: sum('cornerLookups'), cornerPrunes: sum('cornerPrunes'), faceCuts: sum('faceCuts'), bpmxCuts: sum('bpmxCuts'), bpmxSkipped: sum('bpmxSkipped'), recursiveCuts: sum('recursiveCuts') };
}

export async function verifyRun(runDir: string, beforeReport?: () => void) {
  assert(isAbsolute(runDir), 'Run directory must be absolute');
  const inputText = readFileSync(join(runDir, 'input.json'), 'utf8');
  const input = JSON.parse(inputText);
  assert(Array.isArray(input.cases) && input.cases.length > 0, 'Missing input cases');
  assert(integer(input.rounds) && input.rounds >= 1 && input.rounds <= 5, 'Invalid rounds');
  assert(integer(input.threads) && input.threads >= 1 && input.threads <= 127, 'Invalid threads');
  assert(input.pairOrder === undefined || input.pairOrder === 'id-parity-v1', 'Unknown paired solve order');
  assert(input.baselineControl === undefined || input.baselineControl === 'initialized-rank-total-order-v1', 'Unknown baseline control');
  assert(typeof input.sourceHash === 'string' && /^[a-f0-9]{64}$/.test(input.sourceHash), 'Invalid source digest');
  assert(input.sourceHashes && sha(JSON.stringify(input.sourceHashes)) === input.sourceHash, 'Source manifest digest mismatch');
  const cases: Case[] = input.cases;
  const caseIds = new Set<string>();
  for (const item of cases) {
    assert(typeof item.id === 'string' && item.id.length > 0 && !/[\r\n,]/.test(item.id) && !caseIds.has(item.id), 'Invalid/duplicate case ID');
    assert(typeof item.scramble === 'string', `Invalid scramble: ${item.id}`);
    assert(item.htm === undefined || integer(item.htm) && item.htm <= 20, `Invalid known distance: ${item.id}`);
    caseIds.add(item.id);
  }
  const expected: { id: string; item: Case }[] = [];
  for (let round = 0; round <= input.rounds; round++) for (const item of cases)
    expected.push({ id: `${round === 0 ? 'warm' : `r${round}`}-${item.id}`, item });
  const original = rows(join(runDir, 'original.jsonl'));
  const paired = rows(join(runDir, 'paired.jsonl'));
  assert(original.length === expected.length && paired.length === expected.length * 2, 'Incomplete worker result coverage');
  const all = [...original, ...paired];
  for (const [stream, list] of [['original', original], ['paired', paired]] as const) {
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      const index = stream === 'original' ? i : Math.floor(i / 2);
      const run = stream === 'original' ? 0 : i % 2;
      const order = input.pairOrder === 'id-parity-v1' ? Buffer.from(expected[index].id, 'utf8').reduce((value, byte) => value ^ byte, 0) : index;
      const mode = stream === 'original' ? 'original' : (order + run) % 2 ? 'candidate' : 'baseline';
      assert(row && row.id === expected[index].id && row.index === index && row.run === run && row.mode === mode, `Unexpected result identity/order: ${stream}:${i}`);
      assert(integer(row.length) && row.length <= 20 && typeof row.solution === 'string' && row.verified === true, `Invalid solution metadata: ${row.id}`);
      assert(nonnegative(row.seconds), `Invalid elapsed time: ${row.id}`);
      for (const key of ['nodes', 'lookups', 'fallbacks', 'cornerLookups', 'cornerPrunes'] as const)
        assert(integer(row[key]), `Invalid ${key}: ${row.id}`);
      for (const key of ['faceCuts', 'bpmxCuts', 'bpmxSkipped', 'recursiveCuts'] as const) {
        assert(row[key] === undefined || integer(row[key]), `Invalid ${key}: ${row.id}`);
        assert(row.mode === 'candidate' || (row[key] ?? 0) === 0, `BPMX active in baseline: ${row.id}`);
      }
      assert(row.fallbacks <= row.lookups && row.cornerPrunes <= row.cornerLookups, `Inconsistent counters: ${row.id}`);
      assert(row.mode === 'candidate' || row.cornerLookups === 0 && row.cornerPrunes === 0, `Corner pruning active in baseline: ${row.id}`);
      assert(Array.isArray(row.stats) && row.stats.length === 10 && row.stats.every(integer), `Invalid raw stats: ${row.id}`);
      assert(row.stats[0] === row.nodes && row.stats[1] === row.lookups && row.stats[2] === row.fallbacks, `Counter/raw-stat mismatch: ${row.id}`);
      if (input.variant?.startsWith('bpmx')) assert(row.stats[7] === row.bpmxCuts && row.stats[8] === row.bpmxSkipped, `BPMX/raw-stat mismatch: ${row.id}`);
      if (input.variant === 'bpmx-face') assert(row.stats[6] === row.faceCuts, `Face pruning/raw-stat mismatch: ${row.id}`);
      if (input.variant === 'bpmx-recursive') assert(row.stats[9] === row.recursiveCuts && row.recursiveCuts! <= row.bpmxCuts!, `Recursive pruning/raw-stat mismatch: ${row.id}`);
      const tokens = row.solution.trim() ? row.solution.trim().split(/\s+/) : [];
      assert(tokens.length === row.length && tokens.every(token => /^[UDLRFB](?:2|')?$/.test(token)), `Invalid HTM solution tokens: ${row.id}`);
    }
  }
  // The installed package exposes puzzles to ESM import but not require.resolve.
  const puzzleModule = join(root, 'core/jobs/alg-build/node_modules/cubing/dist/lib/cubing/puzzles/index.js');
  const { cube3x3x3 } = await import(pathToFileURL(puzzleModule).href);
  const puzzle = await cube3x3x3.kpuzzle();
  const pattern = (alg: string) => {
    const p = puzzle.defaultPattern().applyAlg(alg).patternData;
    return JSON.stringify([p.EDGES, p.CORNERS]);
  };
  const solved = pattern('');
  const observed = new Map<string, number>();
  for (const row of all) {
    const item = expected[row.index].item;
    assert(pattern(item.scramble + ' ' + row.solution) === solved, `Independent state verification failed: ${row.mode}:${row.id}`);
    assert(item.htm === undefined || row.length === item.htm, `Known optimal length mismatch: ${row.mode}:${row.id}`);
    assert(!observed.has(item.id) || observed.get(item.id) === row.length, `Optimal length differs across modes/rounds: ${item.id}`);
    observed.set(item.id, row.length);
  }
  if (input.threads === 1) {
    if (input.baselineControl === 'initialized-rank-total-order-v1') {
      const counts = new Map<string, string>();
      for (const row of paired) {
        const key = `${row.mode}:${expected[row.index].item.id}`;
        const value = JSON.stringify([row.nodes, row.lookups, row.fallbacks]);
        assert(!counts.has(key) || counts.get(key) === value, `Controlled single-thread counts changed across rounds: ${key}`);
        counts.set(key, value);
      }
    } else {
      const originalById = new Map(original.map(row => [row.id, row]));
      for (const row of paired.filter(row => row.mode === 'baseline')) {
        const control = originalById.get(row.id)!;
        assert(row.nodes === control.nodes && row.lookups === control.lookups && row.fallbacks === control.fallbacks,
          `Disabled candidate differs from original single-thread search: ${row.id}`);
      }
    }
  }
  beforeReport?.();
  const resourcesText = readFileSync(join(runDir, 'resources.json'), 'utf8');
  const finalResources = JSON.parse(resourcesText);
  const baseline = input.baseline;
  assert(baseline && typeof baseline.boot === 'string' && integer(baseline.swapouts), 'Missing resource baseline');
  assert(finalResources.boot === baseline.boot && finalResources.swapouts === baseline.swapouts && finalResources.pressure === 1, 'Resource baseline/pressure mismatch');
  assert(nonnegative(finalResources.peakRss) && finalResources.peakRss <= 32 * 2 ** 30 && nonnegative(finalResources.minimumHeadroom) && finalResources.minimumHeadroom >= 2 * 2 ** 30, 'Resource limit exceeded/missing');
  let h10UnchangedSizeAndMtime: boolean | null = null;
  let h10Verification = 'Unavailable: this saved input does not contain the pre-run H10 size/mtime; no retrospective unchanged claim.';
  if (input.h10Stat !== undefined) {
    assert(input.h10Stat && typeof input.h10Stat.path === 'string' && isAbsolute(input.h10Stat.path) && integer(input.h10Stat.size) && nonnegative(input.h10Stat.mtimeMs), 'Invalid H10 stat evidence');
    const after = statSync(input.h10Stat.path);
    assert(after.size === input.h10Stat.size && after.mtimeMs === input.h10Stat.mtimeMs, 'H10 size/mtime changed since run start');
    h10UnchangedSizeAndMtime = true;
    h10Verification = 'Compared current size/mtime with the pre-run values persisted in input.json; file contents were not rehashed.';
  }
  const sums = modes.map(mode => {
    const measured = all.filter(row => row.mode === mode && !row.id.startsWith('warm-'));
    assert(measured.length === cases.length * input.rounds, `Incomplete measured coverage: ${mode}`);
    return { mode, ...totals(measured), rounds: Array.from({ length: input.rounds }, (_, i) => ({ round: i + 1, ...totals(measured.filter(row => row.id.startsWith(`r${i + 1}-`))) })) };
  });
  const failurePath = join(runDir, 'failure.json');
  const priorFailure = existsSync(failurePath) ? JSON.parse(readFileSync(failurePath, 'utf8')) : null;
  const report = {
    status: 'complete', variant: input.variant ?? 'corners', threads: input.threads, rounds: input.rounds, pairOrder: input.pairOrder ?? 'index-parity', sourceHash: input.sourceHash, sourceHashes: input.sourceHashes,
    cases: cases.length, fixtureSet: input.fixtureSet ?? 'full-60-plus-10-boundaries', verifiedSolutions: all.length, knownOptimalCases: cases.filter(item => item.htm !== undefined).length,
    baselineControl: input.baselineControl ?? null,
    singleThreadCheck: input.threads !== 1 ? 'not applicable' : input.baselineControl ? 'baseline and candidate each repeat identical counts across rounds' : 'disabled candidate equals original counts',
    verification: 'Every saved row checked for complete stream/mode/round coverage, finite counters, HTM moves, independent cubing.js roundtrip, recorded optimal distances and equal lengths across all modes/rounds.',
    sums, resources: { baseline, final: finalResources, peakRss: finalResources.peakRss, minimumHeadroom: finalResources.minimumHeadroom },
    h10UnchangedSizeAndMtime, h10Verification,
    provenance: { runDir, inputSha256: sha(inputText), resourcesSha256: sha(resourcesText), verifierSha256, verifiedAt: new Date().toISOString() },
    priorFailure: priorFailure === null ? null : { file: failurePath, reason: priorFailure.reason, preserved: true },
    methodologyNotes: existsSync(join(runDir, 'run-notes.json')) ? JSON.parse(readFileSync(join(runDir, 'run-notes.json'), 'utf8')) : null,
    timerNote: 'The entire warm-* round is excluded for all modes. ' + (input.variant?.startsWith('bpmx') ? 'All modes use the same public solve entry. ' : 'Candidate time includes light input/header validation. ') + 'Paired baseline shares candidate code layout; original uses unmodified vendor source. ' + (input.pairOrder === 'id-parity-v1' ? 'Paired ordering uses XOR parity of the full UTF-8 input ID, including the round prefix, so consecutive measured rounds reverse each case order.' : 'Paired ordering alternates by input index; with an even number of cases, a given case retains its first/second position across rounds.'),
  };
  atomic(join(runDir, 'report.json'), report);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(process.argv.length === 3, 'Usage: node verify.mts ABS_RUN_DIR');
  console.log(JSON.stringify(await verifyRun(process.argv[2]), null, 2));
}
