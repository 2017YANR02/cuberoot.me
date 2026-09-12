import { monitorEventLoopDelay } from 'node:perf_hooks';
import { statfs } from 'node:fs/promises';
import postgres from 'postgres';
import { databaseSettings } from '../db/settings.js';
import { databaseLoad, diagnosticLog } from './request.js';

/** Independent, read-only observer: a saturated business pool cannot queue it. */
export function startRuntimeDiagnostics(): () => Promise<void> {
  let observer: ReturnType<typeof postgres> | undefined;
  const lag = monitorEventLoopDelay({ resolution: 20 });
  lag.enable();
  let previousCpu = process.cpuUsage();
  let previousTime = performance.now();
  let sampling = false;
  let stopped = false;
  diagnosticLog('api_process_started', { uptimeSeconds: Math.round(process.uptime()) });

  async function sample() {
    if (sampling || stopped) return;
    sampling = true;
    // Emit runtime state before any I/O so observer failures cannot hide stalls.
    const now = performance.now();
    const cpu = process.cpuUsage();
    const loopMaxMs = Math.round(lag.max / 1e6);
    diagnosticLog('api_runtime', {
      uptimeSeconds: Math.round(process.uptime()), rssMiB: Math.round(process.memoryUsage().rss / 1048576),
      cpuPercent: Math.round((cpu.user + cpu.system - previousCpu.user - previousCpu.system) / (now - previousTime) / 10),
      eventLoopMaxMs: loopMaxMs, eventLoopP99Ms: Math.round(lag.percentile(99) / 1e6), database: databaseLoad(),
    }, loopMaxMs >= 250);
    lag.reset(); previousCpu = cpu; previousTime = now;
    try {
      await Promise.all([
        (async () => {
          const current = observer = postgres({
            ...databaseSettings(), max: 1, connect_timeout: 2,
            connection: { application_name: 'cuberoot-diagnostics', statement_timeout: 1500, default_transaction_read_only: true },
          });
          // Bound transport failures too, not only database execution. This pool
          // is discarded after each sample and never serves business requests.
          const deadline = setTimeout(() => { void current.end({ timeout: 0 }); }, 3000);
          deadline.unref();
          try {
            const rows = await current`SELECT state, wait_event_type, wait_event, count(*)::int AS connections,
              count(*) FILTER (WHERE cardinality(pg_blocking_pids(pid)) > 0)::int AS blocked,
              coalesce(max(extract(epoch FROM clock_timestamp() - query_start)) FILTER (WHERE state = 'active'), 0)::float8 AS longest_active_seconds
              FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()
              GROUP BY state, wait_event_type, wait_event`;
            diagnosticLog('database_activity', { groups: rows }, rows.some(row => row.blocked > 0 || row.longest_active_seconds >= 5));
          } catch { diagnosticLog('database_observer_unavailable', {}, true); }
          finally { clearTimeout(deadline); await current.end({ timeout: 0 }); observer = undefined; }
        })(),
        (async () => {
          try {
            // DB data, WAL and uploads currently share /. Override if moved.
            const disk = await statfs(process.env.DIAGNOSTICS_DISK_PATH || '/');
            const availableMiB = Math.floor(disk.bavail * disk.bsize / 1048576);
            diagnosticLog('host_disk', { availableMiB, totalMiB: Math.floor(disk.blocks * disk.bsize / 1048576) }, availableMiB < 3072);
          } catch { diagnosticLog('host_disk_unavailable', {}, true); }
        })(),
      ]);
    } finally { sampling = false; }
  }
  const timer = setInterval(() => { void sample(); }, 30000);
  timer.unref();
  return async () => {
    stopped = true;
    clearInterval(timer);
    lag.disable();
    await observer?.end({ timeout: 0 });
  };
}
