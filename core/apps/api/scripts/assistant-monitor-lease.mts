/** The worker must fail closed if its resource observer dies or stops sampling. */
export const leaseLimits = { maximumAgeMs: 8000, pollMs: 250 };
// The supervisor and its worker run on the same host and share its monotonic
// clock. Wall time is retained for audit timestamps only.
export const monitorClockMs = () => Number(process.hrtime.bigint() / 1_000_000n);
export type MonitorLease = {
  type: 'resource-sample'; parent: number; sequence: number; sampledAt: number;
  sampledMonotonicAtMs: number; deadlineMonotonicAtMs: number;
};
export function leaseViolation(lease: MonitorLease | undefined, now: number, parent: number): string | undefined {
  if (!lease || lease.type !== 'resource-sample' || lease.parent !== parent
    || ![lease.sequence, lease.sampledAt, lease.sampledMonotonicAtMs, lease.deadlineMonotonicAtMs].every(Number.isSafeInteger)) return 'monitor_lease_invalid';
  if (now >= lease.deadlineMonotonicAtMs) return 'time_limit';
  if (lease.sampledMonotonicAtMs > now || now - lease.sampledMonotonicAtMs >= leaseLimits.maximumAgeMs) return 'monitor_lease_expired';
}
export async function requireResourceMonitor(stop: (reason: string) => never, observed: (lease: MonitorLease) => void = () => {}) {
  if (!process.connected || !process.send) throw Error('Paid local evaluation requires a connected resource supervisor');
  const parent = process.ppid, connectedAt = monitorClockMs();
  let lease: MonitorLease | undefined;
  let ready!: () => void;
  const first = new Promise<void>(resolve => { ready = resolve; });
  const check = () => {
    if (!process.connected || process.ppid !== parent) stop('monitor_disconnected');
    const reason = leaseViolation(lease, monitorClockMs(), parent);
    if (reason) stop(reason);
  };
  process.once('disconnect', () => stop('monitor_disconnected'));
  process.on('message', (message: MonitorLease) => {
    if (!message || leaseViolation(message, monitorClockMs(), parent)) stop('monitor_lease_invalid');
    if (lease && (message.sequence <= lease.sequence || message.deadlineMonotonicAtMs !== lease.deadlineMonotonicAtMs
      || message.sampledMonotonicAtMs < lease.sampledMonotonicAtMs)) stop('monitor_lease_invalid');
    // An already expired lease cannot be revived by a delayed heartbeat.
    if (lease) check();
    lease = message;
    check();
    observed(lease);
    ready();
  });
  setInterval(() => {
    if (!lease && monitorClockMs() - connectedAt < leaseLimits.maximumAgeMs) return;
    check();
  }, leaseLimits.pollMs);
  await first;
  return check;
}
