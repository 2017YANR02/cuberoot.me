import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { routePath } from 'hono/route';

type Trace = { requestId: string; dbCalls: number; dbCallMs: number; dbMaxCallMs: number; dbErrors: number };
const traces = new AsyncLocalStorage<Trace>();
let dbInFlight = 0;
let dbPeak = 0;

// IDs are correlation hints, never authentication. Reject arbitrary header text.
export function diagnosticRequestId(value?: string): string {
  return value && /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i.test(value)
    ? value : randomUUID();
}

export function diagnosticLog(event: string, fields: Record<string, unknown>, warning = false): void {
  // Callers supply only numeric metrics, static labels and validated IDs.
  // An unavailable log sink must not turn a successful request into a failure.
  try {
    const line = JSON.stringify({ event, time: new Date().toISOString(), pid: process.pid, ...fields });
    if (warning) console.warn(line); else console.log(line);
  } catch { /* diagnostics are best effort */ }
}

export function databaseLoad() {
  const load = { inFlight: dbInFlight, peakInFlight: dbPeak };
  dbPeak = dbInFlight;
  return load;
}

/** Wall time includes client pool wait + execution; parallel calls can overlap. */
export async function measureDatabase<T>(run: () => PromiseLike<T>): Promise<T> {
  const trace = traces.getStore();
  const start = performance.now();
  dbInFlight++;
  dbPeak = Math.max(dbPeak, dbInFlight);
  let failed = false;
  try { return await run(); }
  catch (error) { failed = true; throw error; }
  finally {
    dbInFlight--;
    const ms = Math.round(performance.now() - start);
    if (trace) {
      trace.dbCalls++;
      trace.dbCallMs += ms;
      trace.dbMaxCallMs = Math.max(trace.dbMaxCallMs, ms);
      if (failed) trace.dbErrors++;
    }
    if (ms >= 1000) diagnosticLog('database_slow_call', { requestId: trace?.requestId, durationMs: ms, failed, inFlight: dbInFlight }, true);
  }
}

export const requestDiagnostics: MiddlewareHandler = async (c, next) => {
  const requestId = diagnosticRequestId(c.req.header('X-Request-ID'));
  const trace: Trace = { requestId, dbCalls: 0, dbCallMs: 0, dbMaxCallMs: 0, dbErrors: 0 };
  const start = performance.now();
  c.header('X-Request-ID', requestId);
  // No request body/header/query logging. Slow timer also captures calls which
  // never finish, including clients that abandon the five-second page check.
  const slowTimer = setTimeout(() => diagnosticLog('api_request_pending', {
    ...trace, elapsedMs: Math.round(performance.now() - start),
  }, true), 4000);
  slowTimer.unref();
  return traces.run(trace, async () => {
    try { await next(); }
    finally {
      clearTimeout(slowTimer);
      const durationMs = Math.round(performance.now() - start);
      const route = routePath(c) || 'unmatched';
      if (durationMs >= 1000 || c.res.status >= 500 || ['/v1/nav/home-locks', '/v1/auth/me', '/v1/auth/profile'].includes(route)) {
        diagnosticLog('api_request', {
          ...trace, route, method: c.req.method, status: c.res.status, durationMs,
        }, durationMs >= 1000 || c.res.status >= 500);
      }
    }
  });
};
