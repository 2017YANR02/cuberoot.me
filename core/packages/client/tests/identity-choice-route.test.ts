import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/identity-choice/route';

vi.mock('@/lib/api-base', () => ({ apiUrl: (path: string) => `https://api.example.test${path}` }));
const generation = '19d53006-8ff0-42c6-97dd-12e9a20c96dd';
const ticket = 'a'.repeat(43);
const handle = 'b'.repeat(43);
const fetcher = vi.fn();
const identityCookie = `__Host-cuberoot-web-session-identity-${handle}=${ticket}`;
function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://www.example.test/api/identity-choice', {
    method: 'POST', headers: { Origin: 'https://www.example.test', 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
beforeEach(() => { vi.stubGlobal('fetch', fetcher); fetcher.mockReset(); });

describe('pending identity HttpOnly vault', () => {
  it('returns an opaque handle while keeping the proof HttpOnly with a bounded lifetime', async () => {
    const response = await POST(request({ operation: 'store', ticket, expiresInSeconds: 900 }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.handle).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.handle).not.toBe(ticket);
    expect(JSON.stringify(body)).not.toContain(ticket);
    expect(response.headers.get('set-cookie')).toContain(`=${ticket}; Path=/; HttpOnly; Max-Age=900; SameSite=Lax; Secure`);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects cross-origin writes and handles without their HttpOnly proof', async () => {
    expect((await POST(request({ operation: 'store', ticket, expiresInSeconds: 900 }, { Origin: 'https://evil.test' }))).status).toBe(403);
    expect((await POST(request({ operation: 'complete', ticket: handle, action: 'create' }))).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses a matched durable cookie for explicit linking and consumes the pending cookie', async () => {
    fetcher.mockResolvedValue(Response.json({ token: 'new-login-proof', user: { uid: 42 } }));
    const cookie = `${identityCookie}; __Host-cuberoot-web-session=${encodeURIComponent(JSON.stringify({ token: 'durable-session', generation }))}`;
    const response = await POST(request({ operation: 'complete', ticket: handle, action: 'link', expectedUid: 42 }, {
      Cookie: cookie, Authorization: `Bearer web-session:${generation}`, 'X-Web-Session': generation,
    }));
    expect(response.status).toBe(200);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.example.test/v1/auth/identity/complete');
    expect(init.headers.get('Authorization')).toBe('Bearer durable-session');
    expect(JSON.parse(init.body)).toEqual({ ticket, action: 'link', expectedUid: 42 });
    expect(init.redirect).toBe('error');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
  it('rejects stale session markers before forwarding linking credentials', async () => {
    const response = await POST(request({ operation: 'complete', ticket: handle, action: 'link', expectedUid: 42 }, {
      Cookie: identityCookie, Authorization: `Bearer web-session:${generation}`, 'X-Web-Session': generation,
    }));
    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps failed confirmations available and never sends browser cookies upstream', async () => {
    fetcher.mockResolvedValue(Response.json({ error: 'invalid target' }, { status: 409 }));
    const response = await POST(request({ operation: 'complete', ticket: handle, action: 'create' }, { Cookie: identityCookie }));
    expect(response.status).toBe(409);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(fetcher.mock.calls[0][1].headers.get('cookie')).toBeNull();
  });
});
