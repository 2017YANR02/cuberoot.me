/**
 * Extract client IP from nginx-set X-Real-IP only. We do NOT fall back to
 * client-controllable X-Forwarded-For.
 */
export function getClientIp(headerLookup: (name: string) => string | undefined): string {
  return headerLookup('x-real-ip') ?? '0.0.0.0';
}

/**
 * Hono-context convenience over getClientIp — the single source for request-IP
 * extraction across all routes. Deliberately NO X-Forwarded-For fallback (see
 * getClientIp): every route sits behind the same nginx, which sets x-real-ip,
 * and XFF is client-forgeable.
 */
export function getIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return getClientIp((n) => c.req.header(n));
}
