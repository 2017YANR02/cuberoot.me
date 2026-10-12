/** Local-only coordinator: audited symmetry model + existing guarded H48 runner. */
import { createReadStream, readFileSync, existsSync, mkdirSync, openSync, closeSync, writeFileSync, fsyncSync, unlinkSync, statfsSync, appendFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createInterface as createPrompt } from 'node:readline/promises';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { atomicJson, maybeJson, readJson, repairTail, guard, TOTAL, GiB, selectPairBatch, pairGroup, CsvTail, claimOwner, askSolverThreads, type Memory, type PairGroup } from './double-zbll-symmetry-state.mjs';
import { activeOwner, watchDashboard, renderDashboard, TerminalDashboard, REFRESH_MS } from './double-zbll-dashboard.mjs';
import { WebsiteStatistics } from './double-zbll-website-stats.mjs';
import { PairSelection } from './double-zbll-selection.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const work = resolve(root, '.tmp/double-zbll-symmetry-v2');
const path = (name: string) => resolve(work, name);
const args = process.argv.slice(2);
if (args.length !== 1 || !['--plan', '--run', '--verify-checkpoint', '--watch'].includes(args[0])) throw Error('使用 --plan 查看，--run 开始或续算，--verify-checkpoint 只验证断点，--watch 只看面板。');
const solve = args[0] === '--run';
let solverThreads: number | undefined;
// A viewer never loads tables, checks startup resources or owns the job.
if (args[0] === '--watch' || (solve && activeOwner(work))) {
  await watchDashboard(work); process.exit(0);
}
const seed = readJson(path('migration.json')), integrity = readJson(path('migration-integrity.json')), audit = readJson(path('audit.json'));
if (seed.status !== 'complete' || seed.unique !== integrity.rows || audit.orbits !== TOTAL) throw Error('迁移或对称审计不完整。');
const progressPath = path('progress.json'), prior = maybeJson(progressPath), checkpoint = maybeJson(path('checkpoint.json'));
const memory = (): Memory => {
  const raw = execFileSync('vm_stat', { encoding: 'utf8', timeout: 5000 });
  const n = (key: string) => { const m = raw.match(new RegExp(key + ':\\s+(\\d+)')); if (!m) throw Error('无法读取 ' + key); return Number(m[1]); };
  const page = Number(raw.match(/page size of (\d+)/)?.[1]); if (!page) throw Error('无法读取内存页大小');
  const disk = statfsSync(work);
  return { boot: execFileSync('sysctl', ['-n', 'kern.boottime'], { encoding: 'utf8', timeout: 5000 }).trim(),
    swapouts: n('Swapouts'), pressure: Number(execFileSync('sysctl', ['-n', 'kern.memorystatus_vm_pressure_level'], { encoding: 'utf8', timeout: 5000 })),
    available: (n('Pages free') + n('File-backed pages')) * page, disk: disk.bavail * disk.bsize };
};
// Reuse the verified migration's boot/swap baseline on first launch.
const baseline = prior ?? seed;
let current = memory();
const count = prior?.verified ?? seed.unique;
if (args[0] === '--plan') {
  console.log(`双底 ZBLL · 对称去重（包含 PLL）\n已验证 ${count.toLocaleString()} / ${TOTAL.toLocaleString()} · ${(100 * count / TOTAL).toFixed(2)}%\n剩余 ${(TOTAL - count).toLocaleString()} 个\n可回收内存 ${(current.available / GiB).toFixed(1)} GiB / 启动门槛 34 GiB\n压力 ${current.pressure === 1 ? '正常' : '异常'} · 换出 ${current.swapouts} 页（基线 ${baseline.baselineSwapouts}）\n磁盘剩余 ${(current.disk / GiB).toFixed(1)} GiB\n${guard(current, baseline, 0, true) ?? '资源检查通过；实际启动时会再次检查。'}\n断点：${work}\n仅查看计划，没有启动求解器。`);
  process.exit(0);
}
if (solve && Date.now() >= Date.parse('2026-12-01T00:00:00Z')) throw Error('本任务运行授权已到期，需要重新核对。');
const preflight = guard(current, baseline, 0, solve);
if (preflight) {
  console.error(`\n暂未启动计算\n${preflight}\n已有 ${count.toLocaleString()} 个结果和断点均保留。`);
  if (current.available < 34 * GiB && current.pressure === 1 && current.boot === baseline.boot && current.swapouts === baseline.baselineSwapouts && baseline.status !== 'protected-stop') {
    console.error(`请先释放至少 ${(34 - current.available / GiB).toFixed(1)} GiB 内存，最好多留一些余量，再点同一快捷指令。`);
  }
  process.exit(2);
}
if (solve) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('请在交互终端启动，输入本次求解线程数后再开始。'); process.exit(2);
  }
  const prompt = createPrompt({ input: process.stdin, output: process.stdout });
  const cancel = new AbortController();
  prompt.once('SIGINT', () => cancel.abort());
  prompt.once('close', () => cancel.abort());
  try { solverThreads = await askSolverThreads(availableParallelism(), text => prompt.question(text, { signal: cancel.signal })); }
  catch (e) { if (!cancel.signal.aborted) throw e; console.log('\n已取消启动，断点保持不变。'); process.exit(0); }
  finally { prompt.close(); }
}
const ownerPath = path('owner.pid');
if (!claimOwner(ownerPath)) { await watchDashboard(work); process.exit(0); }
const screen = new TerminalDashboard();
process.once('exit', () => screen.close());
process.on('exit', () => { try { if (readFileSync(ownerPath, 'utf8') === String(process.pid)) unlinkSync(ownerPath); } catch {} });

let interrupted = false, protectedStop = false, reason = '', child: ChildProcess | undefined, interval: NodeJS.Timeout | undefined;
let stage = '核验已有断点', verified = 0, newCount = 0, activeCompleted = 0, activeTotal = 0, activeBatch = checkpoint?.batch ?? 0;
const histogram = Array.from({ length: 21 }, () => 0);
let sum = 0, peak = prior?.peakRssGiB ?? 0, min = prior?.minimumHeadroomGiB ?? null;
let currentRss = 0, model: any, lengths: Uint8Array, fd: number | undefined;
let websiteStats: WebsiteStatistics | undefined;
let selection: PairSelection;
const scheduler = 'pairs-v1';
let pairFd: number | undefined, activeGroups: PairGroup[] = [], latestPair: any;
const finishedGroups = new Set<number>();
let finishedPairs = 0, comparedPairs = 0, finishedBefore = 0, finishedAfter = 0;
let activeVerified = 0;
let computeStarted = 0, lastRender = 0, sessionNewStart = 0, sessionActiveStart = 0;
const journal = path('solutions.csv'), log = path('run.log');
const stop = (why: string, protection = false) => {
  if (reason) return;
  reason = why; interrupted = true; protectedStop = protection;
  if (child && child.exitCode === null) child.kill('SIGTERM');
};
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(signal, () => stop('已手动停止，断点已保留。'));
const elapsed = () => (prior?.computeSeconds ?? 0) + (computeStarted ? (Date.now() - computeStarted) / 1000 : 0);
function ratePerSecond() {
  const seconds = computeStarted ? (Date.now() - computeStarted) / 1000 : 0;
  return seconds > 0 ? Math.max(0, newCount - sessionNewStart + activeCompleted - activeVerified - sessionActiveStart) / seconds : 0;
}
function snapshot(status: string) {
  return { status, updatedAt: new Date().toISOString(), boot: baseline.boot, baselineSwapouts: baseline.baselineSwapouts,
    total: TOTAL, verified, imported: seed.unique, newlyVerified: newCount, activeBatch, activeCompleted, activeTotal,
    stage, activeVerified, solverThreads, ratePerSecond: ratePerSecond(), memoryPressure: current.pressure, diskGiB: current.disk / GiB,
    computeSeconds: elapsed(), currentSwapouts: current.swapouts, currentRssGiB: currentRss / GiB,
    peakRssGiB: peak, minimumHeadroomGiB: min, availableGiB: current.available / GiB,
    histogram, meanHtm: verified ? sum / verified : null, reason: reason || undefined,
    website: stage === '核验已有断点' ? undefined : websiteStats?.summary(),
    pairs: { finishedPairs, latest: latestPair, comparedPairs,
      meanBefore: comparedPairs ? finishedBefore/comparedPairs : null,
      meanAfter: comparedPairs ? finishedAfter/comparedPairs : null } };
}
function finishPair(group: PairGroup, save = true) {
  if (finishedGroups.has(group.pair) || group.ids.some(id=>!lengths[id])) return;
  const best = Math.min(...group.ids.map(id=>lengths[id]));
  const winner = selection.get(group.pair);
  if (!winner || winner.htm !== best) throw Error('配对候选与最优 HTM 不一致');
  if (save) writeFileSync(pairFd!, `${group.pair},${best}\n`);
  finishedGroups.add(group.pair); finishedPairs += group.top === group.bottom ? 1 : 2;
  for (const [a,b] of group.top === group.bottom ? [[group.top,group.bottom]] : [[group.top,group.bottom],[group.bottom,group.top]]) {
    const before = websiteStats!.pairBaseline(a,b);
    if (before !== null) { comparedPairs++; finishedBefore += before; finishedAfter += best; }
  }
  latestPair = { top: model.cases[group.top].name.replace(/^ZBLL /,''), bottom: model.cases[group.bottom].name.replace(/^ZBLL /,''),
    best, qtm: winner.qtm, generators: winner.generators, stateId: winner.stateId,
    before: websiteStats!.pairBaseline(group.top,group.bottom), states: group.ids.length };
}
function show(force = false, status = 'running') {
  if (!force && Date.now() - lastRender < REFRESH_MS) return;
  lastRender = Date.now();
  const text = renderDashboard(snapshot(status), {
    columns: process.stdout.columns, rows: process.stdout.rows, color: process.stdout.isTTY && !process.env.NO_COLOR,
  });
  screen.render(text);
}
function checkResources() {
  current = memory();
  const list = execFileSync('ps', ['-axo', 'pid,ppid,rss'], { encoding: 'utf8', timeout: 5000 }).trim().split('\n').slice(1).map(s => s.trim().split(/\s+/).map(Number));
  const family = new Set([process.pid]);
  for (let changed = true; changed;) { changed = false; for (const [pid, parent] of list) if (family.has(parent) && !family.has(pid)) { family.add(pid); changed = true; } }
  currentRss = list.reduce((n, [pid, , rss]) => n + (family.has(pid) ? rss * 1024 : 0), 0);
  peak = Math.max(peak, currentRss / GiB); min = Math.min(min ?? Infinity, (current.available - currentRss) / GiB);
  const violation = guard(current, baseline, currentRss);
  if (violation) { stop(violation, true); throw Error(violation); }
  if (!computeStarted && currentRss > 768 * 2 ** 20) { stop('断点核验内存超过 768 MiB。', true); throw Error(reason); }
  if (interrupted) throw Error(reason);
}
async function hashFile(file: string) {
  const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex');
}
function accept(line: string, append: boolean) {
  const match = /^(\d+),(\d+),([URFDLB2' ]+)$/.exec(line); if (!match) throw Error('损坏的结果记录：' + line.slice(0, 80));
  const id = Number(match[1]), n = Number(match[2]), alg = match[3];
  if (!Number.isSafeInteger(id) || id >= lengths.length || n < 1 || n > 20 || alg.trim().split(/\s+/).length !== n
    || model.canonical(Math.floor(id / model.N), id % model.N).id !== id
    || model.pattern(model.setup(id) + ' ' + alg) !== model.solved) throw Error('完整状态验证失败：' + id);
  if (lengths[id] && lengths[id] !== n) throw Error('最优步数冲突：' + id);
  selection.accept(id,n,alg);
  if (lengths[id]) return false;
  if (append) writeFileSync(fd!, line + '\n');
  lengths[id] = n; verified++; histogram[n]++; sum += n; websiteStats?.accept(id, n); return true;
}
async function replay(file: string, imported: boolean) {
  if (!existsSync(file)) return;
  let count = 0;
  for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
    if (!line || !accept(line, false)) throw Error('重复或空白记录：' + file);
    if (!imported) newCount++;
    if (++count % 512 === 0) { checkResources(); show(); await new Promise(r => setImmediate(r)); }
  }
  if (imported && count !== integrity.rows) throw Error('迁移行数不符');
}
async function ingest(batchDir: string, inputs: { id: number; setup: string }[]) {
  const report = readJson(resolve(batchDir, 'report.json')), raw = resolve(batchDir, 'solutions.csv');
  if (report.verified !== inputs.length || report.states !== inputs.length || await hashFile(raw) !== report.solutionsSha256) throw Error('批次未完整验证或 hash 不符。');
  const wanted = new Set(inputs.map(x => x.id));
  for await (const line of createInterface({ input: createReadStream(raw), crlfDelay: Infinity })) {
    const id = Number(line.split(',')[0]); if (!wanted.delete(id)) throw Error('批次未知或重复 ID');
    if (accept(line, true)) { newCount++; activeVerified++; }
    if (wanted.size % 512 === 0) { fsyncSync(fd!); checkResources(); await new Promise(r => setImmediate(r)); }
  }
  if (wanted.size) throw Error('批次缺少结果。'); fsyncSync(fd!);
}
try {
  checkResources(); show(true);
  if (await hashFile(path('representatives.csv')) !== integrity.sha256) throw Error('迁移结果 hash 不符，原结果保留。');
  model = await import(path('model.mts'));
  if (model.orbitCount !== TOTAL || model.N !== 7772 || model.cases.length !== 493) throw Error('模型口径改变。');
  websiteStats = new WebsiteStatistics(root, model);
  selection = new PairSelection(model);
  lengths = new Uint8Array(model.N * model.N);
  await replay(path('representatives.csv'), true);
  if (solve) repairTail(journal);
  await replay(journal, false);
  if (!solve) {
    stage = '断点验证完成（未启动求解器）'; show(true, 'verified');
    screen.close(); console.log(`逐条核验通过：${verified.toLocaleString()} 个；迁移文件 SHA-256 ${integrity.sha256}`);
  } else {
    checkResources();
    const violation = guard(current, baseline, currentRss, true); if (violation) throw Error(violation);
    if (execFileSync('ps', ['-axo', 'comm'], { encoding: 'utf8' }).split('\n').some(s => /solve_h48_h10|table_generator/.test(s))) throw Error('已有求解器或建表任务，禁止重复启动。');
    fd = openSync(journal, 'a');
    let cursor = checkpoint?.cursor ?? 0, pass = checkpoint?.pass ?? 0;
    if (checkpoint?.scheduler !== scheduler) {
      // Preserve all old batches; import even the complete lines from a stopped
      // partial batch, validating each state before switching enumeration order.
      const old = readdirSync(path('batches')).filter(n=>/^\d{6}$/.test(n)).sort();
      for (const name of old) {
        const dir = path('batches/'+name), input = readJson<{id:number}[]>(resolve(dir,'input.json'));
        const wanted = new Set(input.map(r=>r.id)); let consumed = 0;
        new CsvTail().poll(resolve(dir,'solutions.csv'), line=>{
          if (!wanted.delete(Number(line.split(',')[0]))) throw Error('旧批次未知或重复 ID');
          if (accept(line,true)) newCount++;
          if (++consumed % 512 === 0) checkResources();
        });
      }
      fsyncSync(fd);
      if (checkpoint) atomicJson(path(`checkpoint-before-pairs-${Date.now()}.json`),checkpoint);
      activeBatch = old.length ? Number(old.at(-1))+1 : 0; cursor = 0; pass = 0;
      atomicJson(path('checkpoint.json'), { scheduler, batch: activeBatch, cursor, pass });
    }
    const pairsPath = path('finished-pairs.csv'); repairTail(pairsPath);
    if (existsSync(pairsPath)) for await (const line of createInterface({input:createReadStream(pairsPath),crlfDelay:Infinity})) {
      const [pair,best] = line.split(',').map(Number);
      if (!Number.isInteger(pair) || pair<0 || pair>=model.cases.length**2 || finishedGroups.has(pair)) throw Error('配对断点损坏');
      const group = pairGroup(model,Math.floor(pair/model.cases.length),pair%model.cases.length);
      if (group.ids.some(id=>!lengths[id]) || Math.min(...group.ids.map(id=>lengths[id])) !== best) throw Error('配对尚未完整验证');
      finishPair(group,false);
    }
    pairFd = openSync(pairsPath,'a');
    atomicJson(path('selected-pairs.json'), selection.snapshot());
    const wake = spawn('caffeinate', ['-i', '-w', String(process.pid)], { stdio: 'ignore' }); wake.unref();
    sessionNewStart = newCount; computeStarted = Date.now();
    appendFileSync(log, `\n${new Date().toISOString()} 开始/续算，已验证 ${verified}，求解线程 ${solverThreads}\n`);
    while (pass < 2) {
      checkResources();
      const batchDir = path('batches/' + String(activeBatch).padStart(6, '0'));
      let batch = maybeJson(resolve(batchDir, 'batch.json'));
      if (!batch) {
        stage = pass === 0 ? '准备整对 ZBLL' : '准备整对 PLL';
        const selected = await selectPairBatch(model, lengths, cursor, pass, 16384, group=>finishPair(group), async () => { checkResources(); show(); await new Promise(r => setImmediate(r)); });
        cursor = selected.cursor;
        const rows = selected.ids.map(id => ({ id, setup: model.setup(id) }));
        if (!rows.length) { pass++; cursor = 0; continue; }
        mkdirSync(batchDir, { recursive: true }); atomicJson(resolve(batchDir, 'input.json'), rows);
        batch = { scheduler, pass, groups: selected.groups, nextCursor: cursor, rows: rows.length }; atomicJson(resolve(batchDir, 'batch.json'), batch);
      }
      if (batch.scheduler !== scheduler || !Array.isArray(batch.groups)) throw Error('批次调度版本不符');
      activeGroups = batch.groups;
      const groupedIds = new Set<number>();
      for (const group of activeGroups) {
        if (JSON.stringify(pairGroup(model,group.top,group.bottom)) !== JSON.stringify(group)) throw Error('配对分组改变');
        group.ids.forEach(id=>groupedIds.add(id));
      }
      const inputs = readJson<{ id: number; setup: string }[]>(resolve(batchDir, 'input.json'));
      if (inputs.length !== batch.rows || new Set(inputs.map(r => r.id)).size !== inputs.length) throw Error('批次输入异常');
      for (const row of inputs) if (!groupedIds.has(row.id) || row.setup !== model.setup(row.id) || model.canonical(Math.floor(row.id / model.N), row.id % model.N).id !== row.id) throw Error('批次输入状态改变');
      activeTotal = inputs.length; activeVerified = inputs.reduce((n, row) => n + (lengths[row.id] ? 1 : 0), 0);
      const batchProgress = () => maybeJson(resolve(batchDir, 'progress.json'));
      let bp = batchProgress(); activeCompleted = bp?.completed ?? 0;
      if (activeBatch === (checkpoint?.batch ?? 0)) sessionActiveStart = Math.max(0, activeCompleted - activeVerified);
      const tail = new CsvTail(), wanted = new Set(inputs.map(r=>r.id)); let seen = 0;
      const verifyLive = () => {
        tail.poll(resolve(batchDir,'solutions.csv'), line=>{
          if (!wanted.delete(Number(line.split(',')[0]))) throw Error('实时结果未知或重复 ID');
          seen++;
          if (accept(line,true)) { newCount++; activeVerified++; }
        });
        fsyncSync(fd!);
        activeCompleted = Math.max(activeCompleted,seen,activeVerified);
        for (const group of activeGroups) finishPair(group);
        fsyncSync(pairFd!);
      };
      verifyLive();
      stage = '求解中'; atomicJson(progressPath, snapshot('running')); show(true);
      if (bp?.status !== 'complete') {
        const logFd = openSync(log, 'a');
        child = spawn(process.execPath, ['--max-old-space-size=512', '--import', resolve(root, 'core/node_modules/tsx/dist/loader.mjs'),
          resolve(root, '.tmp/double-zbll-auf-20261011/run.mts'), '--solve', `--symmetry-batch=${String(activeBatch).padStart(6, '0')}`],
        { cwd: root, detached: true, env: { ...process.env, THREADS: String(solverThreads), AUF_EXPECTED_BOOT: baseline.boot, AUF_EXPECTED_SWAPOUTS: String(baseline.baselineSwapouts) }, stdio: ['ignore', logFd, logFd] }); closeSync(logFd);
        interval = setInterval(() => {
          try { checkResources(); bp = batchProgress(); activeCompleted = bp?.completed ?? 0; verifyLive(); atomicJson(progressPath, snapshot('running')); show(); }
          catch (e) { stop(String(e), true); }
        }, 1000);
        const code = await new Promise<number | null>((res, rej) => { child!.once('error', rej); child!.once('close', res); });
        clearInterval(interval); interval = undefined; bp = batchProgress();
        verifyLive();
        if (code !== 0 || interrupted || bp?.status !== 'complete') {
          if (!reason) stop(bp?.reason || bp?.error || `批次退出 ${code}，查看 ${log}`, !bp?.reason?.startsWith('Interrupted'));
          throw Error(reason);
        }
      }
      stage = '核验批次完整性'; checkResources(); await ingest(batchDir, inputs);
      for (const group of activeGroups) finishPair(group); fsyncSync(pairFd!);
      cursor = batch.nextCursor; pass = batch.pass; activeBatch++; activeCompleted = 0; activeTotal = 0; activeVerified = 0;
      atomicJson(path('checkpoint.json'), { scheduler, batch: activeBatch, cursor, pass });
      atomicJson(path('selected-pairs.json'), selection.snapshot());
      atomicJson(progressPath, snapshot('running')); show(true);
      appendFileSync(log, `${new Date().toISOString()} 已保存 ${verified}/${TOTAL}\n`);
    }
    if (verified !== TOTAL) throw Error(`枚举不完整：${verified}/${TOTAL}`);
    stage = '全部完成并验证'; atomicJson(progressPath, snapshot('complete')); show(true, 'complete');
    atomicJson(path('solutions-integrity.json'), { total: verified, importedSha256: integrity.sha256, solutionsSha256: await hashFile(journal), histogram });
  }
} catch (e) {
  if (interval) clearInterval(interval);
  if (child?.exitCode === null) child.kill('SIGTERM');
  if (fd !== undefined) fsyncSync(fd);
  if (!reason) reason = String(e);
  stage = protectedStop ? '资源保护停止' : '已停止';
  if (solve) atomicJson(progressPath, { ...snapshot(protectedStop ? 'protected-stop' : 'stopped'), verified: Math.max(verified, prior?.verified ?? seed.unique) });
  show(true, protectedStop ? 'protected-stop' : 'stopped'); screen.close(); console.error(reason); process.exitCode = 1;
} finally { screen.close(); if (interval) clearInterval(interval); if (fd !== undefined) closeSync(fd); if (pairFd !== undefined) { fsyncSync(pairFd); closeSync(pairFd); } }
