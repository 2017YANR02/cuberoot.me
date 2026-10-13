// Fixed ZBLL + historical regression; run only through guard.mts, one engine at a time.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { verify } from './benchmark.mjs';

const root = resolve(import.meta.dirname, '../../..');
const { register } = await import(resolve(root, 'core/node_modules/tsx/dist/esm/api/index.mjs'));
register();
const { rustScramble } = await import(resolve(root, 'solver/333opt/rust-h10-adapter.mts'));
const out = resolve(root, process.argv[2]);
mkdirSync(out, { recursive: false });
const model = await import(resolve(root, '.tmp/double-zbll-symmetry-v2/model.mts'));
const saved = readFileSync(resolve(root, '.tmp/double-zbll-symmetry-v2/representatives.csv'), 'utf8').trim().split('\n');
const cases = Array.from({ length: 64 }, (_, i) => {
  const [id, htm] = saved[Math.floor(i * saved.length / 64)].split(',');
  return { id: `z${id}`, scramble: model.setup(Number(id)), htm: Number(htm), group: 'double-zbll' };
});
const historical = JSON.parse(readFileSync(resolve(root, 'solver/testdata/benchmarks/h48-h10-2026-10-04.json'), 'utf8')).sample.rows;
assert.equal(historical.length, 60);
cases.push(...historical.map(row => ({ ...row, id: `h${row.id}`, group: 'historical' })));
for (const item of cases) assert.equal(model.pattern(rustScramble(item.scramble)), model.pattern(item.scramble), 'exact setup/frame conversion');
const table = resolve(root, 'solver/tables/h48-nissy-core/h48h10.dat');
const rust = resolve(import.meta.dirname, 'target/zbll/release/cube48opt-research');
const c = resolve(root, 'solver/target/release/solve_h48_h10_16');
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
writeFileSync(resolve(out, 'input.json'), JSON.stringify({ cases, table, rust, c, rustHash: hash(rust), cHash: hash(c), rounds: 3 }, null, 2));
const records = [];
async function session(engine, threads) {
  const child = spawn(engine === 'rust' ? rust : c, engine === 'rust' ? ['solve-h10', table, '8', '20', '0'] : [table, String(threads)],
    { env: { ...process.env, CUBEOPT_SOLVE_THREADS: String(threads) }, stdio: ['pipe', 'pipe', 'pipe'] });
  let pending, failed;
  const fail = error => { failed = error; if (pending) { clearTimeout(pending.timer); pending.reject(error); pending = null; } };
  const closed = new Promise((res, rej) => { child.on('error', rej); child.on('close', code => { if (pending) fail(Error(`unexpected exit ${code}`)); res(code); }); });
  child.stdin.on('error', fail);
  child.stderr.on('data', data => appendFileSync(resolve(out, `${engine}-${threads}.stderr.log`), data));
  const reader = createInterface({ input: child.stdout });
  reader.on('line', line => {
    try {
      assert(pending, 'unsolicited output');
      const row = engine === 'rust' ? JSON.parse(line) : (() => { const [id, n, solution] = line.split(','); return { id, length: Number(n), solution }; })();
      assert(pending.wanted.delete(row.id), `duplicate/unknown id ${row.id}`);
      if (engine === 'rust') assert.equal(row.cancelled, false);
      pending.rows.push(row);
      appendFileSync(resolve(out, 'raw.jsonl'), JSON.stringify({ engine, threads, round: pending.round, ...row }) + '\n');
      if (!pending.wanted.size) { const p = pending; pending = null; clearTimeout(p.timer); p.resolve({ rows: p.rows, seconds: (performance.now() - p.started) / 1000 }); }
    } catch (e) { fail(e); child.kill(); }
  });
  try {
    // Initial trivial round excludes startup/full-table validation from search timings.
    const run = (items, round) => new Promise((resolve, reject) => {
      if (failed) return reject(failed);
      pending = { wanted: new Set(items.map(x => x.id)), rows: [], round, started: performance.now(), resolve, reject,
        timer: setTimeout(() => { fail(Error('batch timeout')); child.kill(); }, 10 * 60_000) };
      child.stdin.write(items.map(x => `${x.id}${engine === 'rust' ? '\t' : ','}${engine === 'rust' ? rustScramble(x.scramble) : x.scramble}\n`).join(''));
    });
    const startup = await run([{ id: 'startup', scramble: "R U R'", htm: 3 }], -1);
    verify(model.kp, { id: 'startup', scramble: "R U R'", htm: 3 }, startup.rows[0]);
    for (let round = 0; round < 3; round++) {
      const result = await run(cases, round);
      const expected = new Map(cases.map(x => [x.id, x]));
      for (const row of result.rows) verify(model.kp, expected.get(row.id), row);
      records.push({ engine, threads, round, seconds: result.seconds, verified: result.rows.length });
      console.log(`${engine} ${threads} threads round ${round}: ${result.seconds.toFixed(2)}s; ${result.rows.length} verified`);
      writeFileSync(resolve(out, 'progress.json'), JSON.stringify(records, null, 2));
    }
    child.stdin.end(); assert.equal(await closed, 0);
  } finally { if (child.exitCode === null) child.kill(); reader.close(); }
}
await session('rust', 1);
await session('c', 16);
await session('rust', 16);
const average = (engine, threads) => { const rows = records.filter(x => x.engine === engine && x.threads === threads && x.round > 0); return rows.reduce((s, r) => s + r.seconds, 0) / rows.length; };
const report = { passed: true, binarySha256: hash(rust), table, threads: 16, cases: cases.length, verified: records.reduce((s, r) => s + r.verified, 0),
  rust1Seconds: average('rust', 1), rust16Seconds: average('rust', 16), c16Seconds: average('c', 16),
  speedup: average('c', 16) / average('rust', 16), records, completedAt: new Date().toISOString() };
writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
