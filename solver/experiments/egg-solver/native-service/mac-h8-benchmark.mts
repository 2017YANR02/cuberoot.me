/** Fixed local diagnosis. Launch only as a child of cube48opt-rust/guard.mts. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {appendFileSync, readFileSync, writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {macDir, macReview, macHash, macIdentity} from './mac-h8-policy.mts';
import {readCorpus, parseResult} from '../../cube48opt-rust/remote/native-service-benchmark.mjs';

const plan = JSON.parse(readFileSync(macReview, 'utf8'));
const started = JSON.parse(readFileSync(`${macDir}/started.json`, 'utf8'));
assert.equal(started.guardPid, process.ppid, 'The memory guard must own this driver');
assert.equal(started.planSha256, macHash(macReview));
assert.equal(process.platform, 'darwin'); assert.equal(process.arch, 'arm64');
const {corpus} = readCorpus(plan.corpus);
const save = (name: string, value: unknown) => writeFileSync(`${macDir}/${name}`, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
const append = (name: string, value: unknown) => appendFileSync(`${macDir}/${name}`, JSON.stringify(value) + '\n');
const engines: Record<string, any> = {};

async function run(name: string) {
  for (const [path, identity] of Object.entries(plan.tables)) assert.deepEqual(macIdentity(path), identity);
  const cli = name === 'egg-cli', opt8 = name === 'opt8';
  const binary = opt8 ? plan.opt8Binary : cli ? plan.eggCli : plan.eggAdapter;
  assert.equal(macHash(binary), plan.artifacts[binary]);
  const args = opt8 ? ['solve', plan.snapshot, plan.opt8Table, '8', '20', '0']
    : cli ? ['--table', plan.eggTable, '-t', '4', '-c', '1', '--json', '--load', 'copy']
      : ['serve', plan.eggTable, '4'];
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CUBEOPT_') && !k.startsWith('EGG_SOLVER_')));
  if (opt8) Object.assign(env, {CUBEOPT_VARIANT: '8', CUBEOPT_BACKEND: 'opt', CUBEOPT_SEARCH_THREADS: '4',
    CUBEOPT_SOLVE_THREADS: '1', CUBEOPT_PROTOCOL: 'tsv-v1'});
  const boot = performance.now();
  const child = spawn('/usr/bin/time', ['-l', binary, ...args], {env, stdio: ['pipe', 'pipe', 'pipe']});
  const closed = new Promise<number | null>((ok, no) => {child.on('error', no); child.on('close', ok);});
  child.stderr.on('data', bytes => appendFileSync(`${macDir}/${name}.stderr`, bytes));
  let failure: unknown;
  child.stdin.on('error', error => {failure = error;});
  const rows: any[] = []; let total: any, readyAt = 0, sentAt = 0, totalWall = 0;
  const send = () => {
    const item = corpus.cases[rows.length];
    sentAt = performance.now(); child.stdin.write(`${item.id}\t${item.scramble}\n`);
  };
  if (cli) child.stdin.end(corpus.cases.map((c: any) => c.scramble).join('\n') + '\n');
  try {
    for await (const line of createInterface({input: child.stdout})) {
      appendFileSync(`${macDir}/${name}.stdout`, line + '\n');
      if (cli) {
        const row = JSON.parse(line);
        if (row.type === 'total') {assert.equal(total, undefined); total = row; continue;}
        assert.equal(row.type, 'solved'); assert.equal(row.ok, true); assert.equal(row.index, rows.length);
        const item = corpus.cases[row.index]; assert(item);
        const result = {...row, id: item.id, solution: row.moves};
        rows.push(result); append(`${name}.results.jsonl`, result);
      } else if (!readyAt) {
        assert.equal(line, 'READY\t4'); readyAt = performance.now(); send();
      } else {
        const seconds = (performance.now() - sentAt) / 1000;
        const item = corpus.cases[rows.length]; assert(item);
        const result = {...parseResult(line, item.id), id: item.id, seconds};
        totalWall += seconds; rows.push(result); append(`${name}.results.jsonl`, result);
        if (rows.length === corpus.cases.length) child.stdin.end(); else send();
      }
    }
    const code = await closed;
    assert.equal(code, 0); assert.equal(failure, undefined); assert.equal(rows.length, 100);
    if (cli) {assert.equal(total.cubes, 100); assert.equal(total.threads, 4); assert.equal(total.lanes, 40); assert.equal(total.concurrency, 1);}
    const result = {binary, binarySha256: macHash(binary), args, cases: rows.length,
      totalWallSeconds: cli ? total.wall : totalWall,
      sumCaseSeconds: rows.reduce((n, r) => n + r.seconds, 0),
      measure: cli ? 'Upstream whole-batch wall clock, excluding load; concurrency 1'
        : 'Sum of sequential request/reply wall clocks, excluding load',
      ...(cli ? {upstreamTotal: total} : {startupSeconds: (readyAt - boot) / 1000}),
      processSeconds: (performance.now() - boot) / 1000};
    save(`${name}.report.json`, result); console.log(JSON.stringify({engine: name, ...result}));
    return result;
  } catch (error) {
    child.kill('SIGTERM'); await closed; throw error;
  }
}
try {
  for (const name of plan.order) engines[name] = await run(name);
  save('report.json', {schema: 'cuberoot.egg-h8-mac-result/v1', planSha256: macHash(macReview), engines});
} catch (error) {save('failure.json', {error: String(error)}); throw error;}
