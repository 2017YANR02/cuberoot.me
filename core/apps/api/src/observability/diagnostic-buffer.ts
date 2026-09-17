// Only numeric operational measurements enter this bounded, process-local buffer.
const FIELDS: Record<string, readonly string[]> = {
  api_runtime: ['uptimeSeconds', 'rssMiB', 'cpuPercent', 'eventLoopMaxMs', 'eventLoopP99Ms'],
  host_disk: ['availableMiB', 'totalMiB'],
  api_request: ['status', 'durationMs', 'dbCalls', 'dbCallMs', 'dbMaxCallMs', 'dbErrors'],
  api_request_pending: ['elapsedMs', 'dbCalls', 'dbCallMs', 'dbMaxCallMs', 'dbErrors'],
  database_slow_call: ['durationMs', 'inFlight'],
};
interface Sample { event: string; time: string; metrics: Record<string, number> }
const samples: Sample[] = [];
const startedAt = new Date().toISOString();
let dropped = 0;
export function captureDiagnostic(event: string, fields: Record<string, unknown>) {
  const allowed = FIELDS[event];
  if (!allowed) return;
  const metrics: Record<string, number> = {};
  for (const key of allowed) {
    const value = fields[key];
    if (typeof value === 'number' && Number.isFinite(value)) metrics[key] = value;
  }
  samples.push({ event, time: new Date().toISOString(), metrics });
  if (samples.length > 1000) { samples.shift(); dropped++; }
}
export function recentDiagnostics(limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid sample limit');
  return { startedAt, dropped, retained: samples.length, samples: samples.slice(-limit),
    coverage: 'Process-local numeric samples only; runtime/disk every 30 seconds; requests are slow/error or selected auth routes, not complete traffic. Restart clears history. No request content or identifiers.' };
}
