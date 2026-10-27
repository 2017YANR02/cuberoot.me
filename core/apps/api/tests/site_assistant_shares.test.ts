import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), requireAuth: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: mocks.requireAuth, checkRateLimit: vi.fn() }));
vi.mock('../src/utils/analytics_helpers.js', () => ({ getIp: () => '127.0.0.1' }));
import { siteAssistantSharesRoutes as app } from '../src/routes/site_assistant_shares.js';
const requestId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const id = 'abcdefghijklmnopqrstuvwxyz'.slice(0, 24);
beforeEach(() => { vi.clearAllMocks(); mocks.requireAuth.mockResolvedValue({ uid: 7 }); });
const post = (body: unknown) => app.request('/site-assistant/shares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
it('requires authentication and ownership before creating a public snapshot', async () => {
  mocks.requireAuth.mockResolvedValueOnce({});
  expect((await post({ requestId, question: 'q', answer: 'a' })).status).toBe(401);
  expect(mocks.query).not.toHaveBeenCalled();
  mocks.query.mockResolvedValueOnce([]);
  expect((await post({ requestId, question: 'q', answer: 'a' })).status).toBe(404);
  expect(mocks.query).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('user_id = ?'), [requestId, 7]);
});
it('bounds payloads and excludes images or arbitrary extra fields', async () => {
  expect((await post({ requestId, question: 'q', answer: 'a', images: ['secret'] })).status).toBe(400);
  expect((await post({ requestId, question: 'q', answer: 'a'.repeat(120001) })).status).toBe(400);
  expect(mocks.query).not.toHaveBeenCalled();
});
it('creates an immutable snapshot only after the owner asks', async () => {
  mocks.query.mockResolvedValueOnce([{ id: requestId }]).mockResolvedValueOnce([{ id }]);
  const response = await post({ requestId, question: 'q', answer: 'a' });
  expect(await response.json()).toEqual({ id });
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(mocks.query.mock.calls[1][0]).toContain('ON CONFLICT (user_id, request_id)');
});
it('public reads expose only shared text and revoked links return 404 without caching', async () => {
  mocks.query.mockResolvedValueOnce([{ question: 'q', answer: 'a', user_id: 7 }]);
  const response = await app.request(`/site-assistant/shares/${id}`);
  expect(await response.json()).toEqual({ question: 'q', answer: 'a' });
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(mocks.requireAuth).not.toHaveBeenCalled();
  mocks.query.mockResolvedValueOnce([]);
  expect((await app.request(`/site-assistant/shares/${id}`)).status).toBe(404);
});
it('revocation is restricted to the current owner', async () => {
  mocks.query.mockResolvedValueOnce([]);
  expect((await app.request(`/site-assistant/shares/${id}`, { method: 'DELETE' })).status).toBe(200);
  expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('AND user_id = ?'), [id, 7]);
});
