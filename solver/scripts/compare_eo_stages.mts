/** Read-only comparison of an EO experiment; never launches an analyzer or reads tables.
 * node --experimental-strip-types solver/scripts/compare_eo_stages.mts <evidence-directory>
 * Expected files: plan.json, input.txt, expected.csv, and
 * {baseline,candidate}/{input_eo.csv,analyzer.log}.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
if (args.length !== 1 || args[0] === '--help') {
  console.log('Usage: compare_eo_stages.mts <evidence-directory> (read-only)');
  process.exit(args[0] === '--help' ? 0 : 1);
}
const directory = resolve(args[0]);
const read = (name: string) => readFileSync(resolve(directory, name), 'utf8');
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const lines = (text: string) => text.trimEnd().split(/\r?\n/);
const plan = JSON.parse(read('plan.json'));
assert.equal(plan.schema, 'cuberoot.eo-stage-experiment/v1');
assert.equal(plan.repetitions, 1);
assert.equal(plan.warmup, false);
const input = read('input.txt'), expected = read('expected.csv');
assert.equal(sha(input), plan.inputSha256, 'Frozen input changed');
assert.equal(sha(expected), plan.goldenSha256, 'Frozen golden changed');

const moveNames = ['U', 'U2', "U'", 'D', 'D2', "D'", 'L', 'L2', "L'", 'R', 'R2', "R'", 'F', 'F2', "F'", 'B', 'B2', "B'"];
const inputIds = new Set<string>();
const idsByMoves = new Map<string, string[]>();
for (const line of lines(input)) {
  const split = line.indexOf(',');
  assert(split > 0, 'Invalid input row');
  const id = line.slice(0, split);
  assert(!inputIds.has(id), `Duplicate input ID: ${id}`);
  inputIds.add(id);
  const moves = line.slice(split + 1).trim().split(/\s+/).map(token => {
    const index = moveNames.indexOf(token);
    assert(index >= 0, `Unsupported move in fixture: ${token}`);
    return index;
  }).join(',');
  idsByMoves.set(moves, [...(idsByMoves.get(moves) ?? []), id]);
}
assert.equal(inputIds.size, plan.cases);

function csv(text: string) {
  const [header, ...rows] = lines(text);
  assert.equal(header.split(',').length, 31, 'Expected ID plus 30 distances');
  const data = new Map<string, number[]>();
  for (const row of rows) {
    const [id, ...values] = row.split(',');
    assert(inputIds.has(id) && !data.has(id), `Unknown/duplicate CSV ID: ${id}`);
    assert.equal(values.length, 30, `Missing distance for ${id}`);
    assert(values.every(v => /^\d+$/.test(v) && Number(v) < 99), `Invalid distance for ${id}`);
    data.set(id, values.map(Number));
  }
  assert.equal(data.size, inputIds.size, 'Incomplete CSV');
  return { header, data };
}
const golden = csv(expected);
function variant(name: string) {
  const actual = csv(read(`${name}/input_eo.csv`));
  assert.equal(actual.header, golden.header, `${name}: CSV schema differs`);
  for (const [id, values] of golden.data) assert.deepEqual(actual.data.get(id), values, `${name}: golden mismatch at ${id}`);
  const log = read(`${name}/analyzer.log`);
  assert(!/\[RESUME\]/.test(log), `${name}: resumed runs are not single-pass timing evidence`);
  const done = [...log.matchAll(/^\[DONE\] (\d+) tasks in ([\d.]+)s, nodes=(\d+), output=.+$/gm)];
  assert.equal(done.length, 1, `${name}: expected exactly one completed batch`);
  assert.equal(Number(done[0][1]), plan.cases);
  const remaining = new Map([...idsByMoves].map(([moves, ids]) => [moves, [...ids]]));
  const workerSeconds = [0, 0, 0, 0];
  const symmetries = new Map<string, number[]>();
  // run_analyzer_app writes its stdin prompt to stderr without a newline. The
  // first worker profile can therefore share that line; retain the raw log.
  const profiles = lines(log).map(line => line.replace(/^Enter file \(or exit\): /, ''))
    .filter(line => line.startsWith('[EO_STAGE]'));
  assert.equal(profiles.length, plan.cases, `${name}: missing stage profiles`);
  for (const line of profiles) {
    const match = /^\[EO_STAGE\] moves=([\d,]+) nanos=([\d,]+) sym=([\d,]+)$/.exec(line);
    assert(match, `${name}: malformed stage profile`);
    const id = remaining.get(match[1])?.shift();
    assert(id, `${name}: unexpected/duplicate move sequence`);
    const nanos = match[2].split(',').map(Number), sym = match[3].split(',').map(Number);
    assert.equal(nanos.length, 4);
    assert(nanos.every(n => Number.isSafeInteger(n) && n >= 0));
    assert.equal(sym.length, 48);
    assert(sym.every(n => Number.isSafeInteger(n) && n >= 0 && n < 99));
    const folded = Array.from({ length: 24 }, (_, i) => Math.min(sym[2 * i], sym[2 * i + 1]));
    assert.deepEqual(folded, actual.data.get(id)!.slice(6), `${name}: profile/CSV mismatch at ${id}`);
    symmetries.set(id, sym);
    nanos.forEach((n, i) => { workerSeconds[i] += n / 1e9; });
  }
  const seconds = Number(done[0][2]), nodes = Number(done[0][3]);
  assert(Number.isFinite(seconds) && seconds > 0);
  assert(Number.isSafeInteger(nodes) && nodes > 0);
  return { seconds, nodes, workerSeconds, symmetries };
}
const baseline = variant('baseline'), candidate = variant('candidate');
for (const [id, sym] of baseline.symmetries) assert.deepEqual(candidate.symmetries.get(id), sym, `Raw 48-symmetry mismatch at ${id}`);
console.log(JSON.stringify({
  schema: 'cuberoot.eo-stage-comparison/v1',
  cases: plan.cases,
  goldenDistancesCompared: plan.cases * 30 * 2,
  rawSymmetryDistancesCompared: plan.cases * 48,
  correctness: 'identical',
  baseline: { seconds: baseline.seconds, nodes: baseline.nodes },
  candidate: { seconds: candidate.seconds, nodes: candidate.nodes },
  wallSpeedup: baseline.seconds / candidate.seconds,
  nodeReduction: 1 - candidate.nodes / baseline.nodes,
  stages: ['XCross+EO', 'XXCross+EO', 'XXXCross+EO', 'XXXXCross+EO'].map((stage, i) => ({
    stage, baselineWorkerSeconds: baseline.workerSeconds[i], candidateWorkerSeconds: candidate.workerSeconds[i],
  })),
  timingScope: 'One pass per version, no warmup. DONE wall time includes lazy table loading and checkpoints. Stage durations overlap across workers; they are not batch wall time. Sequential runs can have different OS file-cache conditions.',
}, null, 2));
