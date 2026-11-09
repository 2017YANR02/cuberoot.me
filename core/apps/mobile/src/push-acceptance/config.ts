/** No DNS names, credentials, URL paths, public IPs or production fallback. */
export function acceptanceApiOrigin(raw: string): string {
  const url = new URL(raw);
  const ip = url.hostname.split('.').map(Number);
  const privateIp = /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) && ip.every(n => n >= 0 && n <= 255)
    && (ip[0] === 127 || ip[0] === 10 || ip[0] === 192 && ip[1] === 168 || ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31);
  if (!privateIp || !['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash) throw new Error('Acceptance API must be an explicit loopback/private IPv4 origin');
  return url.origin;
}

export function acceptanceRequest(origin: string, fetcher: typeof fetch = fetch) {
  const base = acceptanceApiOrigin(origin);
  return async (method: string, path: string, body?: unknown, token?: string) => {
    if (!/^\/(?:__acceptance\/(?:session|status|notification)|v1\/notifications\/push\/(?:config(?:\?[^#]*)?|device))$/.test(path)) {
      throw new Error('Acceptance request path rejected');
    }
    const response = await fetcher(base + path, {
      method, redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(10_000),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok || response.headers.get('X-CubeRoot-Push-Acceptance') !== 'fixture-v1') {
      throw new Error(`Isolated fixture API rejected request (${response.status})`);
    }
    return response.json();
  };
}
