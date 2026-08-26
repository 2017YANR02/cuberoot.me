/** Public API origin for absolute asset URLs. */
export function apiOrigin(c: {
  req: { header: (name: string) => string | undefined; url: string };
}): string {
  // Only trust the reverse proxy's forwarded host. A bare Host header is caller-controlled.
  const host = c.req.header('X-Forwarded-Host');
  if (host) {
    const proto = c.req.header('X-Forwarded-Proto') ?? 'https';
    return `${proto}://${host}`;
  }
  try {
    return new URL(c.req.url).origin;
  } catch {
    return '';
  }
}
