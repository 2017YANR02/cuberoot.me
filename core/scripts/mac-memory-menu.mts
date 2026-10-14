#!/usr/bin/env node
/** Read-only SwiftBar display; never starts, stops or changes the solver. */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseVm, memorySummary, parseProcesses } from './mac-system-recorder.mts';

const work = resolve(import.meta.dirname, '../../.tmp/double-zbll-symmetry-v2');
const root = resolve(import.meta.dirname, '../..');
const research = 'solver/experiments/cube48opt-rust';
const guardScript = `${research}/guard.mts`;
const opt10Native = resolve(root, research, 'target/opt10/release/cube48opt-research');
const opt10OfficialNative = resolve(root, research, 'target/opt10-official/release/cube48opt-research');
const GiB = 2 ** 30;
type Processes = ReturnType<typeof parseProcesses>;
function descendants(processes: Processes, seeds: number[]): Set<number> {
  const family = new Set(seeds);
  for (let changed = true; changed;) {
    changed = false;
    for (const p of processes) if (family.has(p.ppid) && !family.has(p.pid)) { family.add(p.pid); changed = true; }
  }
  return family;
}
function computationFamily(processes: Processes, owner: number): Set<number> {
  // Include surviving native solvers even if the coordinator already removed owner.pid.
  return descendants(processes, processes.filter(p => p.pid === owner || /^(?:solve_h48(?:_|$)|cube48opt-research$)/.test(p.name)).map(p => p.pid));
}
function familyRss(processes: Processes, family: Set<number>): number {
  return processes.reduce((n, p) => n + (family.has(p.pid) ? p.rssBytes : 0), 0);
}
export function computeRss(processes: Processes, owner: number): number {
  return familyRss(processes, computationFamily(processes, owner));
}

type Opt10Lock = { pid: number; backend: 'opt10'; entry: 'native'; mode: 'generate-opt10' | 'solve-opt10'; boot: string };
type ProcessIdentity = { guardCwd?: string; commands?: Readonly<Record<number, string>> };
function liveOpt10Lock(processes: Processes, value: unknown, boot: string): value is Opt10Lock {
  if (!value || typeof value !== 'object') return false;
  const lock = value as Partial<Opt10Lock>;
  return Number.isSafeInteger(lock.pid) && Number(lock.pid) > 0 && lock.backend === 'opt10' && lock.entry === 'native'
    && (lock.mode === 'generate-opt10' || lock.mode === 'solve-opt10') && Boolean(boot) && lock.boot === boot
    && processes.some(p => p.pid === lock.pid && p.name === 'node' && !/^[ZX]/.test(p.state));
}

function guardedNativeCommand(command: string, lock: Opt10Lock, cwd: string | undefined) {
  const words = command.trim().split(/\s+/);
  if (basename(words[0] ?? '') !== 'node') return null;
  let at = 1;
  // Only known Node flags may precede the actual entry. A guard path occurring
  // among another script's arguments is not evidence that this is the guard.
  while (words[at] === '--experimental-strip-types' || words[at] === '--no-warnings') at++;
  if (words[at] !== resolve(root, guardScript) && !(words[at] === guardScript && cwd === root)) return null;
  const binary = words[at + 2];
  if (!/^[a-z0-9-]+$/.test(words[at + 1] ?? '') || words[at + 3] !== lock.mode
      || !(binary === opt10Native || binary === opt10OfficialNative && lock.mode === 'solve-opt10')) return null;
  const expected = [binary, lock.mode,
    resolve(root, '.tmp/cubeopt-reverse/opt9-generated/small-memory.bin'),
    resolve(root, '.tmp/cubeopt-reverse/opt10-generated-v2/cuberoot-opt10.dat'),
    ...(lock.mode === 'generate-opt10' ? ['16'] : ['8', '20', '0'])];
  return JSON.stringify(words.slice(at + 2)) === JSON.stringify(expected) ? expected.join(' ') : null;
}

/** Anonymous Opt10 tables already reduce system reclaimable memory. Exempt
 * only its identified native process and the exact guard/time launch chain. */
export function memoryBudget(processes: Processes, owner: number, reclaimableBytes: number,
    lock: unknown, boot: string, guardCommand = '', identity: ProcessIdentity = {}) {
  const family = computationFamily(processes, owner);
  let anonymous = new Set<number>(), opt10Mode: Opt10Lock['mode'] | null = null;
  if (liveOpt10Lock(processes, lock, boot)) {
    // A same-boot PID can be reused. Inspect only this PID's current command;
    // never display or persist its arguments. Unknown wrappers fail closed.
    const tree = descendants(processes, [lock.pid]);
    const nativeCommand = guardedNativeCommand(guardCommand, lock, identity.guardCwd);
    const candidates = processes.filter(p => nativeCommand && tree.has(p.pid) && p.name === 'cube48opt-research'
      && !/^[ZX]/.test(p.state) && identity.commands?.[p.pid]?.trim() === nativeCommand);
    if (candidates.length === 1) {
      const native = candidates[0];
      const wrapper = processes.find(p => p.pid === native.ppid && p.ppid === lock.pid && p.name === 'time'
        && !/^[ZX]/.test(p.state) && identity.commands?.[p.pid]?.trim() === `/usr/bin/time -l ${nativeCommand}`);
      // Unknown siblings/descendants, including an H48 mmap process, still
      // belong to the computation and retain their conservative reservation.
      for (const pid of tree) family.add(pid);
      if (native.ppid === lock.pid || wrapper) {
        anonymous = new Set([lock.pid, native.pid, ...(wrapper ? [wrapper.pid] : [])]);
        opt10Mode = lock.mode;
      }
    }
  }
  const rssBytes = familyRss(processes, family), anonymousRssBytes = familyRss(processes, anonymous);
  const reservedRssBytes = rssBytes - anonymousRssBytes;
  return { rssBytes, anonymousRssBytes, reservedRssBytes, marginBytes: reclaimableBytes - reservedRssBytes, opt10Mode };
}
function output() {
  const out: string[] = [];
  try {
    const command = (bin: string, args: string[] = []) => execFileSync(bin, args, { encoding: 'utf8', timeout: 1000, maxBuffer: 2 * 1024 ** 2, env: { ...process.env, LC_ALL: 'C' } });
    const vm = parseVm(command('/usr/bin/vm_stat')), memory = memorySummary(vm);
    if (!memory) throw Error('系统内存数据不完整');
    const pressure = Number(command('/usr/sbin/sysctl', ['-n', 'kern.memorystatus_vm_pressure_level']).trim());
    if (![1, 2, 4].includes(pressure)) throw Error('无法读取内存压力');
    let owner = 0;
    try { const pid = Number(readFileSync(resolve(work, 'owner.pid'), 'utf8')); if (Number.isSafeInteger(pid) && pid > 0) owner = pid; } catch {}
    const processes = parseProcesses(command('/bin/ps', ['-axo', 'pid,ppid,rss,pcpu,stat,comm']));
    if (!processes.length) throw Error('无法读取进程内存');
    let lock: unknown = null, boot = '', guardCommand = '', identity: ProcessIdentity = {};
    try {
      lock = JSON.parse(readFileSync(resolve(root, '.tmp/cubeopt-reverse/compute.lock'), 'utf8'));
      boot = command('/usr/sbin/sysctl', ['-n', 'kern.boottime']).trim();
      if (liveOpt10Lock(processes, lock, boot)) {
        guardCommand = command('/bin/ps', ['-p', String(lock.pid), '-o', 'command=']);
        const cwd = command('/usr/sbin/lsof', ['-a', '-p', String(lock.pid), '-d', 'cwd', '-Fn']);
        const guardCwd = cwd.split('\n').find(line => line.startsWith('n'))?.slice(1);
        const tree = descendants(processes, [lock.pid]);
        const pids = processes.filter(p => tree.has(p.pid) && ['time', 'cube48opt-research'].includes(p.name)).map(p => p.pid);
        if (pids.length && pids.length <= 8) {
          const observed = command('/bin/ps', ['-p', pids.join(','), '-o', 'pid=,command=']);
          const commands = Object.fromEntries(observed.split('\n').flatMap(line => {
            const match = line.match(/^\s*(\d+)\s+(.+)$/);
            return match ? [[Number(match[1]), match[2]]] : [];
          }));
          identity = { guardCwd, commands };
        }
      }
    } catch { /* Missing/stale identity or command timeout retains the old conservative reservation. */ }
    const budget = memoryBudget(processes, owner, memory.reclaimableEstimateBytes, lock, boot, guardCommand, identity);
    const rss = budget.rssBytes, available = memory.reclaimableEstimateBytes / GiB, margin = budget.marginBytes / GiB;
    out.push(`可用 ${margin.toFixed(1).padStart(4)} GiB | font=Menlo size=12${margin < 2 || pressure !== 1 ? ' color=red' : ''}`);
    out.push('---', budget.opt10Mode ? `Rust Opt10 ${budget.opt10Mode === 'generate-opt10' ? '建表' : '求解'} · 估计内存余量`
      : rss > 0 ? '计算中 · 保守内存余量' : '计算未运行 · 当前系统内存',
      `估计余量：${margin.toFixed(2)} GiB`,
      `系统可回收：${available.toFixed(2)} GiB`,
      `计算进程驻留：${(rss / GiB).toFixed(2)} GiB`,
      `额外保守预留：${(budget.reservedRssBytes / GiB).toFixed(2)} GiB`,
      `内存压力：${pressure === 1 ? '正常' : '异常'}`,
      `本次开机累计换出：${vm.pages.Swapouts.toLocaleString('zh-CN')} 页`,
      '---', '估计余量 = 系统可回收 − 额外保守预留',
      budget.opt10Mode ? 'Opt10 匿名驻留已计入系统占用，不重复扣除。' : rss > 0 ? '未确认内存类型，继续预留全部计算驻留。' : '无计算进程时，显示系统可回收内存。',
      '这是保守估计，并非精确空闲内存。',
      `数据时间：${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
  } catch (e) {
    out.push('可用 — | font=Menlo size=12', '---', '系统内存读取失败，下次刷新重试。');
    // Keep shell output and process details out of the user-facing error.
    if (e instanceof Error && !('code' in e) && !('status' in e)) out.push(e.message.replace(/[\r\n|]/g, ' ').slice(0, 160));
  }
  out.push('---', '每 5 秒更新 · 仅显示，不控制计算', '立即刷新 | refresh=true');
  return out.join('\n');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(output());
