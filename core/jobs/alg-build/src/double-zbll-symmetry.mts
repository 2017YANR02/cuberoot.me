/** Local-only coordinator: audited symmetry model + existing guarded batch runner. */
import { createReadStream, readFileSync, existsSync, mkdirSync, openSync, closeSync, writeFileSync, fsyncSync, unlinkSync, statfsSync, statSync, appendFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createInterface as createPrompt } from 'node:readline/promises';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { atomicJson, maybeJson, readJson, repairTail, guard, TOTAL, GiB, selectPairBatch, pairGroup, CsvTail, claimOwner, askSolverThreads, batchFailure, recoverableStartupStop, waitForStartupMemory, type Memory, type PairGroup } from './double-zbll-symmetry-state.mjs';
import { activeOwner, watchDashboard, renderDashboard, renderCompletion, TerminalDashboard, REFRESH_MS } from './double-zbll-dashboard.mjs';
import { WebsiteStatistics } from './double-zbll-website-stats.mjs';
import { PairSelection } from './double-zbll-selection.mjs';

const root = resolve(import.meta.dirname, '../../../..');
// The standalone solver is outside the job's build unit, like the existing
// runtime-loaded resource adapter below. Keep its source out of job compilation.
interface ResidentSession {
  child: ChildProcess;
  startedAt: string;
  closed: Promise<number>;
  check(): void;
  run(rows: { id: number; scramble: string }[], result: (raw: string, csv: string) => void): Promise<void>;
  finish(): Promise<void>;
}
const { ResidentRustSession } = await import(resolve(root,'solver/333opt/resident-rust-session.mts')) as {
  ResidentRustSession: new (child: ChildProcess) => ResidentSession;
};
const { opt10Configuration, rustScramble } = await import(resolve(root,'solver/333opt/rust-h10-adapter.mts'));
const { observeZbllMemory } = await import(resolve(root,'core/scripts/zbll-memory-budget.mts'));
const work = resolve(root, '.tmp/double-zbll-symmetry-v2');
const path = (name: string) => resolve(work, name);
const args = process.argv.slice(2);
if (args.length !== 1 || !['--plan', '--run', '--verify-checkpoint', '--watch'].includes(args[0])) throw Error('使用 --plan 查看，--run 开始或续算，--verify-checkpoint 只验证断点，--watch 只看面板。');
const solve = args[0] === '--run';
const solverEngine = process.env.DOUBLE_ZBLL_ENGINE ?? (existsSync(path('rust-opt10-acceptance.json')) ? 'opt10' : existsSync(path('rust-h10-acceptance.json')) ? 'rust' : 'c');
if (!['c', 'rust', 'opt10'].includes(solverEngine)) throw Error('DOUBLE_ZBLL_ENGINE 必须为 c、rust 或 opt10');
let solverThreads: number | undefined;
// A viewer never loads tables, checks startup resources or owns the job.
if (args[0] === '--watch' || (solve && activeOwner(work))) {
  await watchDashboard(work); process.exit(0);
}
// Verify the selected release without loading its table, before touching checkpoints.
const opt10Release = solverEngine === 'opt10' && (solve || args[0] === '--plan')
  ? opt10Configuration(root,1).release : undefined;
const seed = readJson(path('migration.json')), integrity = readJson(path('migration-integrity.json')), audit = readJson(path('audit.json'));
if (seed.status !== 'complete' || seed.unique !== integrity.rows || audit.orbits !== TOTAL) throw Error('迁移或对称审计不完整。');
const progressPath = path('progress.json'), prior = maybeJson(progressPath), checkpoint = maybeJson(path('checkpoint.json'));
// A completed task only verifies saved-file hashes and prints its result. No
// thread prompt, replay or solver/table startup is needed on subsequent opens.
if ((solve || args[0] === '--plan') && prior?.verified === TOTAL
  && (prior.status === 'complete' || prior.stage === '全部完成并验证') && existsSync(path('solutions-integrity.json'))) {
  const report = readJson(path('solutions-integrity.json'));
  if (report.total !== TOTAL || report.importedSha256 !== integrity.sha256
    || JSON.stringify(report.histogram) !== JSON.stringify(prior.histogram)
    || await hashFile(path('representatives.csv')) !== report.importedSha256
    || await hashFile(path('solutions.csv')) !== report.solutionsSha256) throw Error('最终结果文件完整性检查未通过，文件保留。');
  const completed = { ...prior, status: 'complete' };
  if (solve && prior.status !== 'complete') atomicJson(progressPath, completed);
  console.log(renderCompletion(completed, work));
  process.exit(0);
}
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
const previousLog = path('run.log');
const recoveredStartup = prior?.status === 'protected-stop' && existsSync(previousLog)
  && recoverableStartupStop(prior, batchFailure(previousLog, Math.max(0, statSync(previousLog).size - 16384), 1),
    existsSync(path(`batches/${String(prior.activeBatch).padStart(6, '0')}/progress.json`)));
// Only the old pre-table startup rejection is reclassified. Never reset boot or swap.
let baseline = recoveredStartup ? { ...prior, status: 'stopped' } : prior ?? seed;
let current = memory();
if (solverEngine === 'opt10') {
  try {
    const {readResumeReview,resumeBaseline}=await import(resolve(root,'solver/experiments/cube48opt-rust/zbll-resume-review.mts'));
    const resume=readResumeReview(current);
    if(resume) baseline=resumeBaseline(prior,resume,readFileSync(progressPath));
  } catch(error) {
    console.error(`\n暂未启动计算\n${error instanceof Error ? error.message : String(error)}\n已有 ${(prior?.verified ?? seed.unique).toLocaleString()} 个结果和断点均保留。`);
    process.exit(2);
  }
}
const count = prior?.verified ?? seed.unique;
if (args[0] === '--plan') {
  console.log(`求解器：${solverEngine === 'opt10' ? `Rust Opt10 · ${opt10Release} · 31.13 GB 表 · 最多 ${Math.min(18,availableParallelism())} 搜索线程` : solverEngine === 'rust' ? 'Rust H10' : 'C H10'}`);
  console.log(`双底 ZBLL · 对称去重（包含 PLL）\n已验证 ${count.toLocaleString()} / ${TOTAL.toLocaleString()} · ${(100 * count / TOTAL).toFixed(2)}%\n剩余 ${(TOTAL - count).toLocaleString()} 个\n可回收内存 ${(current.available / GiB).toFixed(1)} GiB / 启动门槛 34 GiB\n压力 ${current.pressure === 1 ? '正常' : '异常'} · 换出 ${current.swapouts} 页（基线 ${baseline.baselineSwapouts}）\n磁盘剩余 ${(current.disk / GiB).toFixed(1)} GiB\n${guard(current, baseline, 0, true) ?? '资源检查通过；实际启动时会再次检查。'}\n断点：${work}\n仅查看计划，没有启动求解器。`);
  process.exit(0);
}
if (solve && Date.now() >= Date.parse('2026-12-01T00:00:00Z')) throw Error('本任务运行授权已到期，需要重新核对。');
// Low startup memory now waits; all actual runtime violations still fail closed.
const preflight = guard(current, baseline, 0);
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
  try { solverThreads = await askSolverThreads(Math.min(availableParallelism(), solverEngine === 'opt10' ? 18 : Infinity), text => prompt.question(text, { signal: cancel.signal })); }
  catch (e) { if (!cancel.signal.aborted) throw e; console.log('\n已取消启动，断点保持不变。'); process.exit(0); }
  finally { prompt.close(); }
}
const ownerPath = path('owner.pid');
if (!claimOwner(ownerPath)) { await watchDashboard(work); process.exit(0); }
const screen = new TerminalDashboard();
process.once('exit', () => screen.close());
process.on('exit', () => { try { if (readFileSync(ownerPath, 'utf8') === String(process.pid)) unlinkSync(ownerPath); } catch {} });

let interrupted = false, protectedStop = false, reason = '', child: ChildProcess | undefined, interval: NodeJS.Timeout | undefined;
let resident: ResidentSession | undefined, residentVerify: (() => void) | undefined;
let stage = '核验已有断点', verified = 0, newCount = 0, activeCompleted = 0, activeTotal = 0, activeBatch = checkpoint?.batch ?? 0;
const histogram = Array.from({ length: 21 }, () => 0);
let sum = 0, peak = prior?.peakRssGiB ?? 0, min = prior?.minimumHeadroomGiB ?? null;
let reservedRss = 0;
let currentRss = 0, model: any, lengths: Uint8Array, fd: number | undefined;
let websiteStats: WebsiteStatistics | undefined;
let selection: PairSelection;
const scheduler = 'pairs-v1';
let pairFd: number | undefined, activeGroups: PairGroup[] = [], latestPair: any;
const finishedGroups = new Set<number>();
let finishedPairs = 0, comparedPairs = 0, finishedBefore = 0, finishedAfter = 0;
let activeVerified = 0;
let computeStarted = 0, lastRender = 0, sessionNewStart = 0, sessionActiveStart = 0;
let waitedMs = 0, waitingSince = 0;
const journal = path('solutions.csv'), log = path('run.log');
const stop = (why: string, protection = false) => {
  if (reason) return;
  reason = why; interrupted = true; protectedStop = protection;
  if (child && child.exitCode === null) child.kill('SIGTERM');
};
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(signal, () => stop('已手动停止，断点已保留。'));
const sessionSeconds = () => computeStarted ? Math.max(0, ((waitingSince || Date.now()) - computeStarted - waitedMs) / 1000) : 0;
const elapsed = () => (prior?.computeSeconds ?? 0) + sessionSeconds();
function ratePerSecond() {
  const seconds = sessionSeconds();
  return seconds > 0 ? Math.max(0, newCount - sessionNewStart + activeCompleted - activeVerified - sessionActiveStart) / seconds : 0;
}
function snapshot(status: string) {
  return { status, updatedAt: new Date().toISOString(), boot: baseline.boot, baselineSwapouts: baseline.baselineSwapouts,
    reviewedSwapouts:baseline.reviewedSwapouts,resumeReviewSha256:baseline.resumeReviewSha256,
    total: TOTAL, verified, imported: seed.unique, newlyVerified: newCount, activeBatch, activeCompleted, activeTotal,
    stage, activeVerified, solverThreads, solverEngine, residentPid: resident?.child.pid, residentStartedAt: resident?.startedAt,
    ratePerSecond: ratePerSecond(), memoryPressure: current.pressure, diskGiB: current.disk / GiB,
    computeSeconds: elapsed(), currentSwapouts: current.swapouts, currentRssGiB: currentRss / GiB, reservedRssGiB: reservedRss / GiB,
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
  const live = snapshot(status);
  // Startup replay must be visible without replacing the durable checkpoint.
  atomicJson(path('live-progress.json'), { ...live, ownerPid: process.pid });
  const text = renderDashboard(live, {
    columns: process.stdout.columns, rows: process.stdout.rows, color: process.stdout.isTTY && !process.env.NO_COLOR,
  });
  screen.render(text);
}
function checkResources() {
  if (solve && Date.now() >= Date.parse('2026-12-01T00:00:00Z')) { stop('本任务运行授权已到期，需要重新核对。', true); throw Error(reason); }
  current = memory();
  const budget = observeZbllMemory(process.pid,current.available,current.boot);
  currentRss = budget.rssBytes; reservedRss = budget.reservedRssBytes;
  peak = Math.max(peak,currentRss/GiB); min = Math.min(min ?? Infinity,budget.marginBytes/GiB);
  const violation = guard(current,baseline,currentRss,false,reservedRss);
  if (violation) { stop(violation, true); throw Error(violation); }
  if (!computeStarted && currentRss > 768 * 2 ** 20) { stop('断点核验内存超过 768 MiB。', true); throw Error(reason); }
  if (interrupted) throw Error(reason);
}
async function awaitStartupMemory() {
  const previousStage = stage;
  if (computeStarted) waitingSince = Date.now();
  try {
    await waitForStartupMemory(baseline, () => { checkResources(); return { memory: current, rss: currentRss }; }, (m, stable) => {
      stage = stable ? `内存已达标 · 稳定确认 ${stable}/3` : `等待内存 ${(m.available / GiB).toFixed(1)} / 34 GiB · 自动续算`;
      atomicJson(progressPath, snapshot('waiting-memory')); show(true, 'waiting-memory');
    }, () => delay(5000));
  } finally {
    if (waitingSince) { waitedMs += Date.now() - waitingSince; waitingSince = 0; }
    stage = previousStage;
  }
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
  if (solve && recoveredStartup) atomicJson(path(`startup-memory-recovery-${Date.now()}.json`), { previous: prior, checked: current, action: 'Reclassify pre-table startup memory rejection; original boot and swap baseline retained' });
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
    if (existsSync(resolve(root, '.tmp/cubeopt-reverse/compute.lock')) || execFileSync('ps', ['-axo', 'comm'], { encoding: 'utf8' }).split('\n').some(s => /solve_h48_h10|cube48opt-research|table_generator/.test(s))) throw Error('已有求解器、研究锁或建表任务，禁止重复启动。');
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
    appendFileSync(log, `\n${new Date().toISOString()} 开始/续算，已验证 ${verified}，引擎 ${opt10Release ?? solverEngine}，求解线程 ${solverThreads}\n`);
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
      if (solverEngine === 'opt10') repairTail(resolve(batchDir,'solutions.csv'));
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
      if (solverEngine === 'opt10' && bp?.status !== 'complete') {
        const priorBatch = bp;
        if (priorBatch?.reason && priorBatch.reason !== 'Interrupted') throw Error('批次存在未处理的停止记录：' + priorBatch.reason);
        if (priorBatch && (priorBatch.boot !== baseline.boot || priorBatch.baselineSwapouts !== baseline.baselineSwapouts))
          throw Error('批次 boot/Swapouts 基线发生变化');
        residentVerify = verifyLive;
        if (!resident) {
          await awaitStartupMemory();
          const config = opt10Configuration(root, solverThreads!);
          const logFd = openSync(log, 'a');
          try {
            child = spawn(process.execPath, [config.args[0], 'double-zbll-opt10-session', ...config.args.slice(2)],
              { cwd: root, env: { ...process.env, ...config.env }, stdio: ['pipe', 'pipe', logFd] });
          } finally { closeSync(logFd); }
          resident = new ResidentRustSession(child);
          atomicJson(path(`resident-${child.pid}.json`), { ...config, mode: 'resident', guardPid: child.pid,
            startedAt: resident.startedAt, boot: baseline.boot, baselineSwapouts: baseline.baselineSwapouts,
            reviewedSwapouts:baseline.reviewedSwapouts,resumeReviewSha256:baseline.resumeReviewSha256 });
          appendFileSync(log, `${resident.startedAt} 常驻求解器启动 pid=${child.pid}，表仅加载一次\n`);
          stage = '加载并校验大表（仅本次启动）';
          interval = setInterval(() => {
            try {
              resident!.check(); checkResources(); residentVerify?.();
              atomicJson(progressPath, snapshot('running')); show();
            } catch (error) { stop(String(error), true); }
          }, 1000);
        } else { resident.check(); stage = '求解中'; }
        const started = Date.now(), batchOut = resolve(batchDir, 'solutions.csv');
        const batchFd = openSync(batchOut, 'a');
        const rawPath = resolve(batchDir, 'solutions.csv.rust.jsonl'); repairTail(rawPath);
        const rawFd = openSync(rawPath, 'a');
        atomicJson(resolve(batchDir, 'progress.json'), { status: 'solving', boot: baseline.boot,
          baselineSwapouts: baseline.baselineSwapouts, completed: seen, total: inputs.length, residentPid: child!.pid });
        try {
          await resident.run(inputs.filter(row => wanted.has(row.id)).map(row => ({ id: row.id, scramble: rustScramble(row.setup) })), (raw, csv) => {
            const result = JSON.parse(raw);
            if (result.threads !== solverThreads || result.batch_threads !== 1) throw Error('常驻求解线程配置发生变化');
            writeFileSync(rawFd, raw + '\n'); writeFileSync(batchFd, csv + '\n');
            stage = '求解中';
          });
          fsyncSync(batchFd); fsyncSync(rawFd); verifyLive(); checkResources();
          if (wanted.size || seen !== inputs.length) throw Error('常驻批次结果不完整');
          const report = { states: seen, verified: seen, solutionsSha256: await hashFile(batchOut),
            elapsedSeconds: (Date.now() - started) / 1000, baselineSwapouts: baseline.baselineSwapouts,
            finalSwapouts: current.swapouts, residentPid: child!.pid, residentStartedAt: resident.startedAt };
          atomicJson(resolve(batchDir, 'report.json'), report);
          bp = { status: 'complete', completed: seen, total: inputs.length, boot: baseline.boot,
            baselineSwapouts: baseline.baselineSwapouts, updatedAt: new Date().toISOString(), residentPid: child!.pid };
          atomicJson(resolve(batchDir, 'progress.json'), bp);
          appendFileSync(log, `${new Date().toISOString()} 常驻批次 ${activeBatch} 完成 ${seen}/${inputs.length} pid=${child!.pid}\n`);
        } finally { fsyncSync(batchFd); closeSync(batchFd); fsyncSync(rawFd); closeSync(rawFd); residentVerify = undefined; }
      }
      while (solverEngine !== 'opt10' && bp?.status !== 'complete') {
        await awaitStartupMemory();
        stage = '求解中'; atomicJson(progressPath, snapshot('running')); show(true);
        const logFd = openSync(log, 'a');
        const logStart = statSync(log).size;
        child = spawn(process.execPath, ['--max-old-space-size=512', '--import', resolve(root, 'core/node_modules/tsx/dist/loader.mjs'),
          resolve(root, '.tmp/double-zbll-auf-20261011/run.mts'), '--solve', `--symmetry-batch=${String(activeBatch).padStart(6, '0')}`],
        { cwd: root, detached: true, env: { ...process.env, H10_ENGINE: solverEngine, THREADS: String(solverThreads), AUF_EXPECTED_BOOT: baseline.boot, AUF_EXPECTED_SWAPOUTS: String(baseline.baselineSwapouts) }, stdio: ['ignore', logFd, logFd] }); closeSync(logFd);
        interval = setInterval(() => {
          try { checkResources(); bp = batchProgress(); activeCompleted = bp?.completed ?? 0; verifyLive(); atomicJson(progressPath, snapshot('running')); show(); }
          catch (e) { stop(String(e), true); }
        }, 1000);
        const code = await new Promise<number | null>((res, rej) => { child!.once('error', rej); child!.once('close', res); });
        clearInterval(interval); interval = undefined; bp = batchProgress();
        verifyLive();
        if (code !== 0 || interrupted || bp?.status !== 'complete') {
          const failure = batchFailure(log, logStart, code);
          if (!interrupted && failure.startupMemory?.swapouts === baseline.baselineSwapouts) {
            // The child refused before loading tables; repeat the guarded wait,
            // preserving this batch and every saved result. No baseline changes.
            appendFileSync(log, `${new Date().toISOString()} 启动内存波动，返回等待；原基线和本批断点保留。\n`);
            continue;
          }
          if (!reason) stop(bp?.reason || bp?.error || failure.reason, !bp?.reason?.startsWith('Interrupted'));
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
    if (interval) { clearInterval(interval); interval = undefined; }
    if (resident) await resident.finish();
    atomicJson(path('solutions-integrity.json'), { total: verified, importedSha256: integrity.sha256, solutionsSha256: await hashFile(journal), histogram });
    stage = '全部完成并验证'; atomicJson(progressPath, snapshot('complete')); show(true, 'complete');
    screen.close(); console.log(renderCompletion(snapshot('complete'), work));
  }
} catch (e) {
  if (interval) clearInterval(interval);
  if (child?.exitCode === null) child.kill('SIGTERM');
  if (resident) await resident.closed;
  if (fd !== undefined) fsyncSync(fd);
  if (!reason) reason = String(e);
  stage = protectedStop ? '资源保护停止' : '已停止';
  if (solve) atomicJson(progressPath, { ...snapshot(protectedStop ? 'protected-stop' : 'stopped'), verified: Math.max(verified, prior?.verified ?? seed.unique) });
  show(true, protectedStop ? 'protected-stop' : 'stopped'); screen.close(); console.error(`${reason}\n已保存 ${Math.max(verified, prior?.verified ?? seed.unique).toLocaleString()} 个结果，断点保留。`); process.exitCode = 1;
} finally { screen.close(); if (interval) clearInterval(interval); if (fd !== undefined) closeSync(fd); if (pairFd !== undefined) { fsyncSync(pairFd); closeSync(pairFd); } }
