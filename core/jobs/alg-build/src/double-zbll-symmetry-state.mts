import { openSync, closeSync, writeFileSync, readSync, fsyncSync, renameSync, existsSync, readFileSync, copyFileSync, truncateSync, statSync, mkdirSync, rmdirSync, unlinkSync } from 'node:fs';

export const TOTAL = 7_555_446;
export const GiB = 2 ** 30;
export async function askSolverThreads(maximum: number, ask: (prompt: string) => Promise<string>): Promise<number> {
  if (!Number.isSafeInteger(maximum) || maximum < 1) throw Error('无法确定可用 CPU 线程数');
  const fallback = Math.min(16, maximum);
  let error = '';
  for (;;) {
    const answer = (await ask(`${error}线程数（1–${maximum}，回车使用 ${fallback}）：`)).trim();
    if (!answer) return fallback;
    const value = Number(answer);
    if (/^\d+$/.test(answer) && Number.isSafeInteger(value) && value >= 1 && value <= maximum) return value;
    error = `请输入 1–${maximum} 之间的整数。\n`;
  }
}
// Serialize stale-owner recovery as well as initial creation. A crash during
// this tiny critical section leaves a claim directory and fails closed.
export function claimOwner(path: string): boolean {
  const claim = path + '.claim';
  try { mkdirSync(claim); } catch { throw Error('启动检查正在进行，或上次启动检查中断；请核对 owner.pid.claim 后重试。'); }
  try {
    if (existsSync(path)) {
      const pid = Number(readFileSync(path, 'utf8'));
      if (!Number.isSafeInteger(pid) || pid < 1) throw Error('异常 owner 文件，需要检查。');
      try { process.kill(pid, 0); return false; } catch (e: any) { if (e.code !== 'ESRCH') throw e; }
      unlinkSync(path);
    }
    const fd = openSync(path, 'wx');
    try { writeFileSync(fd, String(process.pid)); fsyncSync(fd); } finally { closeSync(fd); }
    return true;
  } finally { rmdirSync(claim); }
}
export interface Memory { boot: string; swapouts: number; pressure: number; available: number; disk: number }
export interface Baseline { boot: string; baselineSwapouts: number; reviewedSwapouts?: number; status?: string; reason?: string }

/** Read only this launch's bounded log tail, including failures before progress.json exists. */
export interface BatchFailure { reason: string; startupMemory?: { available: number; swapouts: number; pressure: number } }
export function batchFailure(log: string, start: number, code: number | null): BatchFailure {
  const fallback = { reason: `批次退出 ${code}，查看 ${log}` };
  let fd: number | undefined;
  try {
    const end = statSync(log).size;
    if (!Number.isSafeInteger(start) || start < 0 || end <= start) return fallback;
    const offset = Math.max(start, end - 16 * 1024), tail = Buffer.alloc(end - offset);
    fd = openSync(log, 'r');
    const bytes = readSync(fd, tail, 0, tail.length, offset);
    const error = [...tail.subarray(0, bytes).toString('utf8').matchAll(/^Error: ([^\r\n]+)$/gm)].at(-1)?.[1];
    if (!error) return fallback;
    if (error.startsWith('Insufficient resources: ')) {
      const m = JSON.parse(error.slice('Insufficient resources: '.length));
      if (Number.isFinite(m.available) && Number.isFinite(m.pressure)) {
        const cause = m.pressure !== 1 ? '系统内存压力异常' : `可回收内存 ${ (m.available / GiB).toFixed(2) } GiB，低于启动门槛 34 GiB`;
        const startupMemory = code === 1 && m.pressure === 1 && m.available >= 0 && m.available < 34 * GiB
          && Number.isSafeInteger(m.swapouts) && m.swapouts >= 0 ? m : undefined;
        return { reason: `本批未启动：${cause}。已保存结果与断点保留；需要复核资源后恢复。`, startupMemory };
      }
    }
    return { reason: `批次退出 ${code}：${error.slice(0, 800)}\n日志：${log}` };
  } catch { return fallback; }
  finally { if (fd !== undefined) closeSync(fd); }
}
export const batchFailureReason = (log: string, start: number, code: number | null) => batchFailure(log, start, code).reason;

// Migrate only the old coordinator's exact pre-table memory rejection. Other
// protected stops remain locked; the caller still checks the original boot/swap.
export function recoverableStartupStop(p: any, failure: BatchFailure, hasBatchProgress: boolean): boolean {
  const m = failure.startupMemory;
  return !!m && !hasBatchProgress && p?.status === 'protected-stop' && p.reason === failure.reason
    && p.activeCompleted === 0 && p.activeVerified === 0 && p.memoryPressure === 1
    && p.currentSwapouts === p.baselineSwapouts && m.swapouts === p.baselineSwapouts
    && Number.isFinite(p.currentRssGiB) && p.currentRssGiB < 0.75;
}

/** Wait without a native solver. Every sample retains the full runtime guard. */
export async function waitForStartupMemory(baseline: Baseline,
  sample: () => { memory: Memory; rss: number }, waiting: (m: Memory, stable: number) => void,
  sleep: () => Promise<void>) {
  let stable = 0;
  for (;;) {
    const { memory, rss } = sample(), violation = guard(memory, baseline, rss);
    if (violation) throw Error(violation);
    stable = memory.available >= 34 * GiB ? stable + 1 : 0;
    if (stable === 3) return;
    waiting(memory, stable);
    await sleep();
  }
}

export function guard(m: Memory, baseline: Baseline, rss: number, starting = false, reservedRss = rss): string | null {
  if (![m.swapouts, m.pressure, m.available, m.disk, rss, reservedRss, baseline.baselineSwapouts].every(Number.isFinite)) return '资源数据读取失败，停止。';
  if (baseline.status === 'protected-stop') return `上次已触发资源保护，需要检查后才能恢复，不能自动重设基线。${baseline.reason ? '\n上次原因：' + baseline.reason : ''}`;
  if (m.boot !== baseline.boot) return '电脑已重新启动，需要核对上次停止原因和新的换出基线后再恢复。';
  const expectedSwapouts = baseline.reviewedSwapouts ?? baseline.baselineSwapouts;
  if (!Number.isSafeInteger(expectedSwapouts) || expectedSwapouts < baseline.baselineSwapouts) return '复核换出记录异常。';
  if (m.swapouts !== expectedSwapouts) return `系统换出计数变化：${expectedSwapouts} → ${m.swapouts}。禁止自动重启。`;
  if (m.pressure !== 1) return '系统内存压力异常。';
  if (m.disk < 30 * GiB) return '磁盘剩余空间不足 30 GiB。';
  if (starting && m.available < 34 * GiB) return `可回收内存约 ${(m.available / GiB).toFixed(1)} GiB，启动需要至少 34 GiB。`;
  if (rss > 32 * GiB) return '计算进程组内存超过 32 GiB。';
  if (reservedRss < 0 || reservedRss > rss) return '资源预留数据异常。';
  if (m.available - reservedRss < 2 * GiB) return '扣除额外预留后的保守余量不足 2 GiB。';
  return null;
}
export function atomicJson(path: string, data: unknown) {
  const fd = openSync(path + '.tmp', 'w');
  try { writeFileSync(fd, JSON.stringify(data, null, 2) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(path + '.tmp', path);
}
// Only an incomplete final append is recoverable automatically, with a backup.
export function repairTail(path: string) {
  if (!existsSync(path) || !statSync(path).size) return;
  const fd = openSync(path, 'r'), size = statSync(path).size;
  const tail = Buffer.alloc(Math.min(4096, size));
  try { readSync(fd, tail, 0, tail.length, size - tail.length); } finally { closeSync(fd); }
  if (tail[tail.length - 1] === 10) return;
  const last = tail.lastIndexOf(10);
  if (last < 0 && size > tail.length) throw Error('异常末行超过 4096 bytes，保留原文件并停止。');
  copyFileSync(path, `${path}.recovery-${Date.now()}`);
  truncateSync(path, size - tail.length + last + 1);
}
export function readJson<T = any>(path: string): T { return JSON.parse(readFileSync(path, 'utf8')); }
export function maybeJson<T = any>(path: string): T | null { return existsSync(path) ? readJson<T>(path) : null; }
export function duration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return '采集速度后估算';
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 86400)}天 ${Math.floor(s / 3600) % 24}时 ${Math.floor(s / 60) % 60}分`;
}

export async function selectBatch(model: { N: number; states: { caseIndex: number }[]; canonical: (a: number, b: number) => { id: number } },
  lengths: Uint8Array, cursor: number, pass: number, limit: number, tick: () => Promise<void>) {
  const ids: number[] = [];
  while (cursor < lengths.length && ids.length < limit) {
    const id = cursor++, a = Math.floor(id / model.N), b = id % model.N;
    const pll = model.states[a].caseIndex >= 472 || model.states[b].caseIndex >= 472;
    if (!lengths[id] && pll === (pass === 0) && model.canonical(a, b).id === id) ids.push(id);
    if (cursor % 131072 === 0) await tick();
  }
  return { ids, cursor };
}

export interface PairModel {
  N: number; phases: number[][]; canonical(a: number, b: number): { id: number };
}
export interface PairGroup { pair: number; top: number; bottom: number; ids: number[] }
export function pairGroup(model: PairModel, top: number, bottom: number): PairGroup {
  const ids = new Set<number>();
  for (const a of model.phases[top]) for (const b of model.phases[bottom]) ids.add(model.canonical(a, b).id);
  return { pair: top * model.phases.length + bottom, top, bottom, ids: [...ids].sort((a,b)=>a-b) };
}
// Complete a whole pair before the next; batching only amortizes table startup.
// Pass 0 is ordinary ZBLL, pass 1 contains PLL. Swapped pairs share one group.
export async function selectPairBatch(model: PairModel, lengths: Uint8Array, cursor: number, pass: number,
  limit: number, complete: (group: PairGroup) => void, tick: () => Promise<void>, plainCases = 472) {
  const groups: PairGroup[] = [], ids: number[] = [], queued = new Set<number>();
  const n = model.phases.length;
  while (cursor < n*n) {
    const top = Math.floor(cursor/n), bottom = cursor%n;
    const eligible = bottom >= top && (top >= plainCases || bottom >= plainCases) === (pass === 1);
    if (eligible) {
      const group = pairGroup(model, top, bottom);
      const missing = group.ids.filter(id => !lengths[id] && !queued.has(id));
      if (!missing.length && group.ids.every(id=>lengths[id])) complete(group);
      else {
        if (ids.length && ids.length + missing.length > limit) break;
        groups.push(group); for (const id of missing) { ids.push(id); queued.add(id); }
      }
    }
    cursor++;
    if (cursor % 128 === 0) await tick();
    if (ids.length >= limit) break;
  }
  return { ids, groups, cursor };
}

/** Consume complete appended lines; retain a partial final line for the next poll. */
export class CsvTail {
  private offset = 0;
  private partial = '';
  poll(file: string, consume: (line: string) => void) {
    if (!existsSync(file)) return;
    const size = statSync(file).size;
    if (size < this.offset) throw Error('结果文件缩短，停止以保护断点。');
    const fd = openSync(file, 'r');
    try {
      const buffer = Buffer.alloc(64*1024);
      while (this.offset < size) {
        const read = readSync(fd, buffer, 0, Math.min(buffer.length, size-this.offset), this.offset);
        if (!read) break;
        this.offset += read;
        const lines = (this.partial + buffer.subarray(0,read).toString('utf8')).split('\n');
        this.partial = lines.pop()!;
        for (const line of lines) consume(line);
      }
    } finally { closeSync(fd); }
  }
}
