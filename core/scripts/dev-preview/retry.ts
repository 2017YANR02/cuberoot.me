// Retry transport failures, never identity, key, permission or configuration errors.
import { setTimeout as sleep } from 'node:timers/promises';
export class RetryableError extends Error {}
export function retryable(error: unknown): boolean {
  if (error instanceof RetryableError) return true;
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; status?: number; name?: string; message?: string; stderr?: unknown; cause?: unknown };
  const detail = `${e.message ?? ''}\n${String(e.stderr ?? '')}`;
  if (/permission denied|host key verification failed|remote host identification has changed|conflict|invalid|mismatch|unauthorized|forbidden/i.test(detail)) return false;
  if (e.status===75 || ['ECONNRESET','ECONNREFUSED','ETIMEDOUT','EAI_AGAIN','ENETUNREACH','EHOSTUNREACH','EPIPE','ENOTFOUND','ENODATA'].includes(e.code ?? '') || e.name === 'TimeoutError') return true;
  return /\b(?:ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN)\b|connection (?:timed out|reset|refused|closed)|operation timed out|closed by remote host|broken pipe|server [^\r\n]+ not responding|could not resolve host|temporary failure in name resolution|network is unreachable|TLS handshake timeout|unexpected EOF|HTTP (?:408|429|5\d\d)\b/i.test(detail) || retryable(e.cause);
}
export const retryDelay = (attempt: number) => Math.min(300_000, 5000 * 2 ** Math.min(Math.max(attempt, 0), 6));
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
