// ── 速率限制 ──

// NOTE: 内存速率限制——默认每 IP 每分钟 30 次写操作
const rateLimitMap = new Map<string, number[]>();
const RATE_WINDOW = 60_000; // 60 秒（毫秒）
const RATE_MAX = 30;

/**
 * 每 IP 滑动窗口限流。
 *
 * `bucket` 给高频但廉价的路由独立额度 —— 默认桶是「写操作」的保守额度(recon 提交等),
 * 训练器房间那种「每换一题一次」的调用共用它必然误伤:用户手速正常就会撞 30/分,
 * 而 4G / 校园网 NAT 后面还是多人共享同一出口 IP。不分桶时行为与旧版完全一致。
 */
export function checkRateLimit(ip: string, opts?: { bucket?: string; max?: number }): void {
  const now = Date.now();
  const key = opts?.bucket ? `${opts.bucket}|${ip}` : ip;
  const max = opts?.max ?? RATE_MAX;
  let timestamps = rateLimitMap.get(key) ?? [];
  // NOTE: 清理过期记录
  timestamps = timestamps.filter(t => t > now - RATE_WINDOW);

  if (timestamps.length >= max) {
    throw new RateLimitError(Math.max(1, Math.ceil((timestamps[0] + RATE_WINDOW - now) / 1000)));
  }

  timestamps.push(now);
  rateLimitMap.set(key, timestamps);
}

/** Keep the existing message contract while exposing the actual rolling-window wait. */
export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
  }
}
