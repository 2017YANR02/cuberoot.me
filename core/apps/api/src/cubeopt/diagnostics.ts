import { readFile, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { diagnosticLog, currentDiagnosticRequestId } from '../observability/request.js';

const exec = promisify(execFile);
const number = (text: string, key: string): number | null => {
  const value = text.match(new RegExp(`^${key}:?\\s+(\\d+)`, 'm'))?.[1];
  return value === undefined ? null : Number(value);
};
const optionalRead = (path: string) => readFile(path, 'utf8').catch(() => '');

export function parseProcess(stat: string, status: string) {
  // comm may contain spaces and parentheses; numeric fields start after its LAST ')'.
  const fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
  if (!stat.includes(')') || fields.length < 22) throw new Error('invalid proc stat');
  const startTicks = Number(fields[19]);
  const majorFaults = Number(fields[9]);
  const cpuTicks = Number(fields[11]) + Number(fields[12]);
  if (![startTicks, majorFaults, cpuTicks].every(Number.isFinite)) throw new Error('invalid proc counters');
  return { startTicks, majorFaults, cpuTicks, state: fields[0],
    rssKiB: number(status, 'VmRSS'), swapKiB: number(status, 'VmSwap') };
}

export function parseHost(stat: string, meminfo: string, vmstat: string) {
  const cpu = stat.match(/^cpu\s+(.+)$/m)?.[1].trim().split(/\s+/).map(Number);
  if (!cpu || cpu.length < 8 || !cpu.every(Number.isFinite)) throw new Error('invalid host stat');
  return { totalTicks: cpu.slice(0, 8).reduce((a, b) => a + b, 0), waitTicks: cpu[4],
    cpuCount: stat.match(/^cpu\d+\s/gm)?.length || 1,
    availableKiB: number(meminfo, 'MemAvailable'), swapFreeKiB: number(meminfo, 'SwapFree'),
    swapInPages: number(vmstat, 'pswpin'), swapOutPages: number(vmstat, 'pswpout') };
}

type Raw = { at: number; host: ReturnType<typeof parseHost>; process: ReturnType<typeof parseProcess> | null; solverPid: number | null };
export function sampleRates(previous: Raw | null, current: Raw) {
  const ms = previous ? current.at - previous.at : 0;
  const ticks = previous ? current.host.totalTicks - previous.host.totalTicks : 0;
  const sameProcess = previous?.solverPid === current.solverPid && previous?.process && current.process
    && previous.process.startTicks === current.process.startTicks;
  const perSecond = (now: number | null, before: number | null | undefined) =>
    ms > 0 && now !== null && before != null && now >= before ? Math.round((now - before) * 1000 / ms) : null;
  return {
    intervalMs: ms || null,
    ioWaitPercent: previous && ticks > 0 && current.host.waitTicks >= previous.host.waitTicks
      ? Math.round((current.host.waitTicks - previous.host.waitTicks) / ticks * 100) : null,
    swapInPagesPerSecond: perSecond(current.host.swapInPages, previous?.host.swapInPages),
    swapOutPagesPerSecond: perSecond(current.host.swapOutPages, previous?.host.swapOutPages),
    majorFaultsPerSecond: sameProcess ? perSecond(current.process!.majorFaults, previous!.process!.majorFaults) : null,
    cpuPercent: sameProcess && ticks > 0 && current.process!.cpuTicks >= previous!.process!.cpuTicks
      ? Math.round((current.process!.cpuTicks - previous!.process!.cpuTicks) / ticks * current.host.cpuCount * 100) : null,
  };
}

export type SolverState = { solverPid: number | null; ready: boolean; queueDepth: number; activeJobId: string | null };

/** Best-effort observer. It never loads a table, kills a process, or changes scheduling. */
export function createSolverDiagnostics(getState: () => SolverState) {
  let previous: Raw | null = null;
  let sampling = false;
  let capturing = false;
  let stopped = false;
  let lastCapture = -Infinity;
  let timer: ReturnType<typeof setInterval> | undefined;

  async function snapshot(reason: string) {
    if (stopped || process.platform !== 'linux' || capturing || performance.now() - lastCapture < 60_000) return;
    capturing = true;
    lastCapture = performance.now();
    const capturedState = getState();
    try {
      const allIds = (await readdir('/proc')).filter(id => /^\d+$/.test(id));
      // Prefer the observed solver even if a connection leak exceeds the bound.
      const observedId = String(capturedState.solverPid || process.pid);
      const ids = (allIds.includes(observedId)
        ? [observedId, ...allIds.filter(id => id !== observedId)] : allIds).slice(0, 16384);
      const processCounts = new Map<string, number>();
      const processes: { pid: number; name: string; rssKiB: number; swapKiB: number; cgroup: string }[] = [];
      let index = 0;
      await Promise.all(Array.from({ length: 8 }, async () => {
        while (index < ids.length) {
          const id = ids[index++];
          const status = await optionalRead(`/proc/${id}/status`);
          const name = status.match(/^Name:\s+(.+)$/m)?.[1].slice(0, 32) || '';
          if (name) processCounts.set(name, (processCounts.get(name) || 0) + 1);
          const rssKiB = number(status, 'VmRSS');
          if (rssKiB === null) continue; // exited/kernel thread
          const cgroup = await optionalRead(`/proc/${id}/cgroup`);
          const group = cgroup.split('\n').find(line => /^\d+:(?:memory|):/.test(line))?.split(':').slice(2).join(':') || '';
          processes.push({ pid: Number(id), name,
            rssKiB, swapKiB: number(status, 'VmSwap') || 0, cgroup: group.slice(0, 200) });
        }
      }));
      let runningServices: string[] | null = null;
      try {
        const { stdout } = await exec('systemctl', ['list-units', '--type=service', '--state=running', '--no-legend', '--no-pager', '--plain'], { timeout: 1500, maxBuffer: 65536, env: { ...process.env, LC_ALL: 'C' } });
        runningServices = stdout.split('\n').map(line => line.trim().split(/\s+/)[0]).filter(unit => /^[\w@.\\:-]+\.service$/.test(unit)).slice(0, 100);
      } catch { /* systemd is optional */ }
      if (!stopped) diagnosticLog('cubeopt_snapshot', { reason, ...capturedState,
        processCount: allIds.length, scannedProcessCount: ids.length, truncated: allIds.length > ids.length,
        processCounts: [...processCounts].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, count]) => ({ name, count })),
        topMemory: processes.sort((a, b) => b.rssKiB + b.swapKiB - a.rssKiB - a.swapKiB).slice(0, 12), runningServices }, reason !== 'periodic');
    } catch { if (!stopped) diagnosticLog('cubeopt_snapshot_unavailable', { reason }, true); }
    finally { capturing = false; }
  }

  async function sample() {
    if (stopped || sampling || process.platform !== 'linux') return;
    sampling = true;
    const state = getState();
    try {
      const [stat, meminfo, vmstat, procStat, status, cgroup, globalSwap] = await Promise.all([
        readFile('/proc/stat', 'utf8'), readFile('/proc/meminfo', 'utf8'), readFile('/proc/vmstat', 'utf8'),
        state.solverPid ? optionalRead(`/proc/${state.solverPid}/stat`) : '',
        state.solverPid ? optionalRead(`/proc/${state.solverPid}/status`) : '',
        optionalRead(`/proc/${state.solverPid || process.pid}/cgroup`), optionalRead('/proc/sys/vm/swappiness'),
      ]);
      const group = cgroup.split('\n').find(line => /^\d+:memory:/.test(line))?.split(':')[2];
      const groupSwap = group ? await optionalRead(`/sys/fs/cgroup/memory${group}/memory.swappiness`) : '';
      const current: Raw = { at: performance.now(), host: parseHost(stat, meminfo, vmstat), solverPid: state.solverPid,
        process: procStat && status ? parseProcess(procStat, status) : null };
      const rates = sampleRates(previous, current);
      previous = current;
      const pressure = (rates.majorFaultsPerSecond ?? 0) >= 100 || (rates.ioWaitPercent ?? 0) >= 20
        || (rates.swapOutPagesPerSecond ?? 0) >= 256 || (current.host.availableKiB !== null && current.host.availableKiB < 512 * 1024);
      if (!stopped) diagnosticLog('cubeopt_sample', { ...state, host: current.host, solver: current.process, ...rates,
        globalSwappiness: globalSwap.trim() ? Number(globalSwap) : null,
        cgroupSwappiness: groupSwap.trim() ? Number(groupSwap) : null }, pressure);
      if (pressure) void snapshot('memory_or_io_pressure');
      else void snapshot('periodic');
    } catch { if (!stopped) diagnosticLog('cubeopt_sample_unavailable', state, true); }
    finally { sampling = false; }
  }

  return {
    start() {
      if (timer || stopped) return;
      diagnosticLog('cubeopt_monitor_started', { supported: process.platform === 'linux', sampleMs: 10_000, snapshotCooldownMs: 60_000 });
      void sample();
      timer = setInterval(() => { void sample(); }, 10_000);
      timer.unref();
    },
    snapshot,
    stop() { stopped = true; if (timer) clearInterval(timer); },
  };
}

/** Per-job lifecycle timing survives queueing; IDs join nginx/request and process logs. */
export function traceSolverJob(jobId: string, capture: (reason: string) => Promise<void>) {
  const received = performance.now();
  const requestId = currentDiagnosticRequestId();
  let queued: number | null = null;
  let started: number | null = null;
  let finished = false;
  let phase = 'loading';
  const fields = () => ({ jobId, requestId, phase, totalMs: Math.round(performance.now() - received),
    loadMs: queued === null ? null : Math.round(queued - received),
    queueMs: queued === null ? null : Math.round((started ?? performance.now()) - queued),
    solveMs: started === null ? null : Math.round(performance.now() - started) });
  diagnosticLog('cubeopt_job_received', fields());
  const slow = setTimeout(() => {
    if (finished) return;
    diagnosticLog('cubeopt_job_slow', fields(), true);
    void capture('slow_job');
  }, 10_000);
  slow.unref();
  return {
    queued(depth: number) { queued = performance.now(); phase = 'queued'; diagnosticLog('cubeopt_job_queued', { ...fields(), queueDepth: depth }); },
    started() { started = performance.now(); phase = 'solving'; diagnosticLog('cubeopt_job_started', fields()); },
    finish(outcome: string, htm?: number) {
      if (finished) return;
      finished = true;
      clearTimeout(slow);
      diagnosticLog('cubeopt_job_finished', { ...fields(), outcome, htm }, outcome !== 'success');
      if (outcome !== 'success') void capture(outcome);
    },
  };
}
