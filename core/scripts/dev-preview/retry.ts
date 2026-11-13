// Retry transport failures, never identity, key, permission or configuration errors.
import { setTimeout as sleep } from 'node:timers/promises';
export class RetryableError extends Error {}
const terminalFailure = /permission denied|host key verification failed|remote host identification has changed|conflict|invalid|mismatch|unauthorized|forbidden/i;
export function retryable(error: unknown): boolean {
  if (error instanceof RetryableError) return true;
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; status?: number; name?: string; message?: string; stderr?: unknown; cause?: unknown };
  const detail = `${e.message ?? ''}\n${String(e.stderr ?? '')}`;
  if (terminalFailure.test(detail)) return false;
  if (e.status===75 || ['ECONNRESET','ECONNREFUSED','ETIMEDOUT','EAI_AGAIN','ENETUNREACH','EHOSTUNREACH','EPIPE','ENOTFOUND','ENODATA'].includes(e.code ?? '') || e.name === 'TimeoutError') return true;
  return /\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN)\b|connection (?:timed out|reset|refused|closed)|operation timed out|closed by remote host|broken pipe|server [^\r\n]+ not responding|could not resolve host|temporary failure in name resolution|network is unreachable|TLS handshake timeout|unexpected EOF|HTTP (?:408|429|5\d\d)\b/i.test(detail) || retryable(e.cause);
}
export const retryDelay = (attempt: number) => Math.min(300_000, 5000 * 2 ** Math.min(Math.max(attempt, 0), 6));

// Tunnel-only policy: a stale remote listener can outlive a dropped connection.
// Do not make forwarding/configuration failures retryable for provisioning jobs.
export class TunnelRetryPolicy {
  private failures = 0;
  private forwardingFailures = 0;

  next(code: number | null, message: string, durationMs: number): number | null {
    const forwardingFailure = /remote port forwarding failed for listen port\b/i.test(message);
    // A connection that stayed up resets backoff; a rejected forwarding request does not.
    if (durationMs >= 60_000 && !forwardingFailure) {
      this.failures = 0;
      this.forwardingFailures = 0;
    }
    if (terminalFailure.test(message)) return null;
    if (forwardingFailure) {
      // Six retries allow stale server-side sessions time to expire, then require inspection.
      if (++this.forwardingFailures > 6) return null;
    } else if (code !== 0 && !retryable({ message })) return null;
    return Math.min(60_000, retryDelay(++this.failures));
  }
}
export async function retry<T>(operation: () => Promise<T>, options: { sleep?: (ms: number) => Promise<void>; notify?: (ms: number) => void; signal?: AbortSignal } = {}): Promise<T> {
  const wait = options.sleep ?? (ms => sleep(ms, undefined, { signal: options.signal }));
  for (let attempt = 0; ; attempt++) {
    options.signal?.throwIfAborted();
    try { return await operation(); }
    catch (error) {
      if (!retryable(error)) throw error;
      options.signal?.throwIfAborted();
      const ms = retryDelay(attempt); options.notify?.(ms); await wait(ms);
    }
  }
}
