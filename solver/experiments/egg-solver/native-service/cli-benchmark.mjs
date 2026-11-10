// One original-CLI pass to isolate the already measured TSV adapter. Linux only.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createInterface} from 'node:readline';
import {admissionDisabled, assertNoConflict, assertResources, processRows, startSafetyMonitor,
  systemSample, treeRows} from '../../cube48opt-rust/remote/native-service-benchmark.mjs';

assert.equal(process.platform, 'linux'); assert.equal(process.arch, 'x64');
const [task] = process.argv.slice(2); assert(task?.startsWith('/root/egg-h8-'));
const binary = `${task}/candidate/solve`, table = `${task}/egg-h8.dat`, out = `${task}/cli100`;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const build = JSON.parse(readFileSync(`${task}/candidate/build.json`));
assert.equal(hash(readFileSync(binary)), build.files.solve.sha256);
const cases = JSON.parse(readFileSync(`${task}/cases100.json`));
assert.equal(cases.length, 100);
assert.equal(hash(readFileSync(`${task}/cases100.json`)), '06124ee37fe96897fd81eb0f4af24442f2edba6d387a69ab0291316aef793e0c');
assert.equal(statSync(table).size, 7_782_731_776);
mkdirSync(out);
const save = (name, value) => writeFileSync(`${out}/${name}`, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
await admissionDisabled(); assertResources(systemSample(), 0, true); assertNoConflict(processRows(), [binary]);
const initial = systemSample(), boot = performance.now();
const args = ['--table', table, '-t', '4', '-c', '1', '--json', '--load', 'copy'];
const child = spawn(binary, args, {detached: true, stdio: ['pipe', 'pipe', 'pipe']});
let failure, killTimer, logBytes = 0;
const signal = sig => {try {process.kill(-child.pid, sig);} catch (e) {if (e.code !== 'ESRCH') throw e;}};
const stop = error => {if (failure) return; failure = String(error.stack ?? error); signal('SIGTERM'); killTimer = setTimeout(() => signal('SIGKILL'), 1500);};
const exit = new Promise(resolve => {child.once('error', stop); child.once('close', (code, sig) => resolve({code, signal: sig}));});
save('started.json', {startedAt: new Date().toISOString(), pid: child.pid, binary, build, args, initial,
  driverSha256: hash(readFileSync(import.meta.filename)), warmupCases: 0, measuredPasses: 1});
for (const [stream, name] of [[child.stdout, 'stdout.log'], [child.stderr, 'stderr.log']]) stream.on('data', chunk => {
  try {logBytes += chunk.length; assert(logBytes < 64 * 2 ** 20); appendFileSync(`${out}/${name}`, chunk);} catch (e) {stop(e);}
});
const rows = []; let total;
const reading = (async () => {
  try {for await (const line of createInterface({input: child.stdout})) {
    const row = JSON.parse(line);
    if (row.type === 'total') {assert.equal(total, undefined); total = row; continue;}
    assert.equal(row.type, 'solved'); assert.equal(row.ok, true); assert.equal(row.index, rows.length);
    assert(cases[row.index]);
    const result = {...row, id: cases[row.index].id, solution: row.moves};
    rows.push(result); appendFileSync(`${out}/results.jsonl`, JSON.stringify(result) + '\n');
  }} catch (e) {stop(e);}
})();
const monitor = startSafetyMonitor({
  sampleResources() {
    const all = processRows(), tree = treeRows(all, child.pid), current = systemSample();
    const rss = tree.reduce((n, p) => n + p.rssBytes, 0);
    appendFileSync(`${out}/resources.jsonl`, JSON.stringify({...current, pid: child.pid, treeRssBytes: rss, treeSwapBytes: tree.reduce((n, p) => n + p.swapBytes, 0)}) + '\n');
    assert.equal(current.bootId, initial.bootId); assertResources(current, rss);
    assertNoConflict(all, [binary], tree.map(p => p.pid)); assert(performance.now() - boot < 10 * 60_000, 'CLI diagnosis timeout');
  }, onAdmission: row => appendFileSync(`${out}/admission.jsonl`, JSON.stringify(row) + '\n'), onFailure: stop,
});
const interrupt = () => stop(Error('CLI diagnosis interrupted'));
process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
child.stdin.on('error', stop); child.stdin.end(cases.map(c => c.scramble).join('\n') + '\n');
const status = await exit; await reading; await monitor.stop(); clearTimeout(killTimer);
process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt);
const remaining = treeRows(processRows(), child.pid);
if (remaining.length) {signal('SIGKILL'); failure ??= 'CLI left descendants';}
save('exit.json', {...status, failure: failure ?? null, processSeconds: (performance.now() - boot) / 1000});
assert(!failure, failure); assert.equal(status.code, 0); assert.equal(rows.length, 100);
assert.equal(total.cubes, 100); assert.equal(total.threads, 4); assert.equal(total.lanes, 40); assert.equal(total.concurrency, 1);
save('report.json', {...total, sumCaseSeconds: rows.reduce((n, r) => n + r.seconds, 0), resultsSha256: hash(readFileSync(`${out}/results.jsonl`)), measuredPasses: 1, warmupCases: 0});
console.log(JSON.stringify(total));
