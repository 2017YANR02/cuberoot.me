#!/usr/bin/env node
/** Read-only SwiftBar display; never starts, stops or changes the solver. */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseVm, memorySummary, parseProcesses } from './mac-system-recorder.mts';

const work = resolve(import.meta.dirname, '../../.tmp/double-zbll-symmetry-v2');
const GiB = 2 ** 30;
export function computeRss(processes: ReturnType<typeof parseProcesses>, owner: number): number {
  // Include surviving native solvers even if the coordinator already removed owner.pid.
  const family = new Set(processes.filter(p => p.pid === owner || /^(?:solve_h48(?:_|$)|cube48opt-research$)/.test(p.name)).map(p => p.pid));
  for (let changed = true; changed;) {
    changed = false;
    for (const p of processes) if (family.has(p.ppid) && !family.has(p.pid)) { family.add(p.pid); changed = true; }
  }
  return processes.reduce((n, p) => n + (family.has(p.pid) ? p.rssBytes : 0), 0);
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
    const rss = computeRss(processes, owner), available = memory.reclaimableEstimateBytes / GiB, margin = available - rss / GiB;
    out.push(`可用 ${margin.toFixed(1).padStart(4)} GiB | font=Menlo size=12${margin < 2 || pressure !== 1 ? ' color=red' : ''}`);
    out.push('---', rss > 0 ? '计算中 · 保守内存余量' : '计算未运行 · 当前系统内存',
      `保守余量：${margin.toFixed(2)} GiB`,
      `系统可回收：${available.toFixed(2)} GiB`,
      `计算进程驻留：${(rss / GiB).toFixed(2)} GiB`,
      `内存压力：${pressure === 1 ? '正常' : '异常'}`,
      `本次开机累计换出：${vm.pages.Swapouts.toLocaleString('zh-CN')} 页`,
      '---', '保守余量 = 系统可回收 − 计算进程驻留',
      '无计算进程时，显示系统可回收内存。',
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
