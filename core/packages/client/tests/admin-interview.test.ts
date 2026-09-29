import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));
import { readFile } from 'node:fs/promises';
import { GET } from '@/app/api/admin/interview/route';
import { decodeWebSessionUserEnvelope } from '@cuberoot/shared/auth/web-session';

const member = {
  user: { uid: 1, wcaId: '', name: 'Member', avatar: '', country: '', isAdmin: false },
};
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  vi.mocked(readFile).mockReset();
  vi.mocked(readFile).mockResolvedValue(JSON.stringify({ questions: [1, 2, 3, 4, 5, 6, 7].map(id => ({ id })) }));
});
afterEach(() => { vi.unstubAllGlobals(); });
const request = (authorization?: string) => new Request('http://localhost:3000/api/admin/interview', {
  headers: authorization ? { Authorization: authorization } : {},
});

describe('private interview material', () => {
  it('rejects missing or malformed bearer credentials without fetching or returning material', async () => {
    for (const auth of [undefined, 'Basic abc', 'Bearer', 'Bearer a b']) {
      const response = await GET(request(auth));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });
  it('denies ordinary accounts even when the caller claims an administrator role', async () => {
    expect(decodeWebSessionUserEnvelope(member)?.user.isAdmin).toBe(false);
    vi.mocked(fetch).mockResolvedValue(Response.json(member));
    const input = request('Bearer valid-member');
    input.headers.set('X-Admin', 'true');
    const response = await GET(input);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Forbidden' });
    expect(readFile).not.toHaveBeenCalled();
  });
  it('fails closed for rejected sessions, upstream failure, or malformed account data', async () => {
    for (const status of [401, 403, 500]) {
      vi.mocked(fetch).mockResolvedValue(Response.json({}, { status }));
      const response = await GET(request('Bearer rejected'));
      expect(response.status).toBe(status === 500 ? 503 : 401);
      expect(await response.text()).not.toContain('questions');
    }
    vi.mocked(fetch).mockResolvedValue(Response.json({ isAdmin: true }));
    expect((await GET(request('Bearer malformed'))).status).toBe(503);
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    expect((await GET(request('Bearer unavailable'))).status).toBe(503);
    expect(readFile).not.toHaveBeenCalled();
  });
  it('serves all seven questions only after verifying the live administrator session', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ user: { ...member.user, isAdmin: true } }));
    const response = await GET(request('Bearer verified-admin'));
    expect(response.status).toBe(200);
    const draft = await response.json();
    expect(draft.questions.map((item: { id: number }) => item.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Authorization');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ cache: 'no-store', headers: { Authorization: 'Bearer verified-admin' } });
  });
});
