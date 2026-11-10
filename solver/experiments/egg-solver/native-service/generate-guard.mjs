// Linux-only, one-shot generation. No retries, table scans or production changes.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, statfsSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { admissionDisabled, assertNoConflict, assertResources, processRows, startSafetyMonitor,
  systemSample, treeRows } from '../../cube48opt-rust/remote/native-service-benchmark.mjs';

assert.equal(process.platform, 'linux'); assert.equal(process.arch, 'x64');
const [task] = process.argv.slice(2); assert(task?.startsWith('/'));
const binary = `${task}/candidate/cuberoot-egg`, table = `${task}/egg-h8.dat`, out = `${task}/generation`;
const build = JSON.parse(readFileSync(`${task}/candidate/build.json`));
assert.equal(createHash('sha256').update(readFileSync(binary)).digest('hex'), build.files['cuberoot-egg'].sha256);
assert.equal(build.upstream, '947c20d93564f150aad9c292486ab730a329b86c');
mkdirSync(out); // A consumed attempt cannot be silently reused.
const save = (name, value) => writeFileSync(`${out}/${name}`, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const disk = statfsSync(task);
assert(disk.bavail * disk.bsize >= 7_782_731_776 + 1024 ** 3, 'Insufficient disk space');
await admissionDisabled(); assertResources(systemSample(), 0, true); assertNoConflict(processRows(), [binary]);
const started = performance.now(), initial = systemSample();
const child = spawn(binary, ['generate', table, '4'], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
let failure, killTimer, logBytes = 0;
const signal = sig => { try { process.kill(-child.pid, sig); } catch (e) { if (e.code !== 'ESRCH') throw e; } };
const stop = error => { if (failure) return; failure = String(error.stack ?? error); signal('SIGTERM'); killTimer = setTimeout(() => signal('SIGKILL'), 1500); };
const exit = new Promise(resolve => { child.once('error', stop); child.once('close', (code, sig) => resolve({ code, signal: sig })); });
save('started.json', { at: new Date().toISOString(), pid: child.pid, build, initial, diskAvailable: disk.bavail * disk.bsize,
  limits: { seconds: 3600, threads: 4, reserveBytes: 2 * 1024 ** 3, rssBytes: 7_782_727_680 + 1024 ** 3 } });
for (const [stream, name] of [[child.stdout, 'stdout.log'], [child.stderr, 'stderr.log']]) stream.on('data', chunk => {
  try { logBytes += chunk.length; assert(logBytes < 64 * 1024 ** 2); appendFileSync(`${out}/${name}`, chunk); }
  catch (error) { stop(error); }
});
const monitor = startSafetyMonitor({
  sampleResources() {
    const rows = processRows(), tree = treeRows(rows, child.pid), current = systemSample();
    const rss = tree.reduce((sum, p) => sum + p.rssBytes, 0);
    appendFileSync(`${out}/resources.jsonl`, JSON.stringify({ ...current, pid: child.pid, treeRssBytes: rss,
      treeSwapBytes: tree.reduce((sum, p) => sum + p.swapBytes, 0) }) + '\n');
    assert.equal(current.bootId, initial.bootId); assertResources(current, rss);
    assertNoConflict(rows, [binary], tree.map(p => p.pid)); assert(performance.now() - started < 3600_000, 'Generation timeout');
  },
  onAdmission: row => appendFileSync(`${out}/admission.jsonl`, JSON.stringify(row) + '\n'), onFailure: stop,
});
const interrupt = () => stop(Error('Generation interrupted'));
process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
const status = await exit;
await monitor.stop(); clearTimeout(killTimer);
process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt);
const remaining = treeRows(processRows(), child.pid);
if (remaining.length) { signal('SIGKILL'); failure ??= 'Generator left descendants'; }
save('exit.json', { ...status, pid: child.pid, seconds: (performance.now() - started) / 1000, failure: failure ?? null, remainingPids: remaining.map(p => p.pid) });
assert(!failure, failure); assert.equal(status.code, 0); assert.equal(status.signal, null);
assert.equal(statSync(table).size, 7_782_731_776);
const receipt = JSON.parse(readFileSync(`${table}.generation.json`));
assert.equal(receipt.bytes, 7_782_731_776); assert.equal(receipt.k, 8); assert.match(receipt.sha256, /^[a-f0-9]{64}$/);
console.log(JSON.stringify({ generated: true, ...receipt }));
