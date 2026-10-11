import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn() }));
vi.mock('../src/utils/recon_helpers.js', () => ({ requireAuth: mocks.auth, checkRateLimit: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query, withTransaction: async (f: (q: typeof mocks.query) => unknown) => f(mocks.query) }));
import { remoteAccessRoutes } from '../src/routes/remote_access';
import { normalizeRemoteKey } from '@cuberoot/shared/remote-access';
import { reconcileKeys } from '../scripts/remote-access-host';
const key = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILX0ASs3XktuhMw0kwIYLoLbRGQZLuQq9hkafwCqDB8C';
const id = '12345678-1234-4567-8123-123456789abc';
const app = new Hono().route('/v1', remoteAccessRoutes);
const call = (path: string, body: unknown, token = '') => app.request('/v1/remote-access/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('REMOTE_ACCESS_HOST_TOKEN', 'x'.repeat(40));
  mocks.auth.mockResolvedValue({ uid: 2, name: 'Employee', isAdmin: false, realWcaId: '2020TEST01' });
  mocks.query.mockResolvedValue([]);
});
describe('remote access security boundary', () => {
  it('does not let an ordinary website admin approve OS access', async () => {
    mocks.auth.mockResolvedValue({ uid: 2, isAdmin: true, realWcaId: '2020TEST01' });
    expect((await call(`requests/${id}/decision`, { decision: 'approved' })).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('rejects role-preview credentials even for the owner', async () => {
    mocks.auth.mockResolvedValue({ uid: 1, isAdmin: true, realWcaId: '2017YANR02' });
    const token = jwt.sign({ uid: 1, previewId: 'preview' }, 'test');
    expect((await call(`requests/${id}/decision`, { decision: 'approved' }, token)).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('requires a separate credential for host snapshots and acknowledgments', async () => {
    expect((await app.request('/v1/remote-access/host/keys')).status).toBe(401);
    expect((await call('host/applied', { revision: 'a'.repeat(64) }, 'wrong')).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('never acknowledges a stale host snapshot', async () => {
    expect((await call('host/applied', { revision: 'a'.repeat(64) }, 'x'.repeat(40))).status).toBe(409);
    expect(mocks.query.mock.calls.some(([sql]) => /UPDATE remote_access_requests/.test(sql))).toBe(false);
  });
  it('scopes employee lists to the signed-in account', async () => {
    expect((await app.request('/v1/remote-access/requests')).status).toBe(200);
    expect(mocks.query.mock.calls[0][0]).toContain('WHERE user_id = ?');
    expect(mocks.query.mock.calls[0][1]).toEqual([2]);
  });
  it('records an owner approval without claiming the host has applied it', async () => {
    mocks.auth.mockResolvedValue({ uid: 1, isAdmin: true, realWcaId: '2017YANR02' });
    mocks.query.mockResolvedValueOnce([{id}]).mockResolvedValueOnce([]);
    expect((await call(`requests/${id}/decision`, { decision: 'approved' })).status).toBe(200);
    expect(mocks.query.mock.calls[0][0]).toContain("status='pending'");
    expect(mocks.query.mock.calls[0][1]).toEqual(['approved',id]);
    expect(mocks.query.mock.calls[1][1]).toEqual([id,1,'approved']);
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes('applied_at'))).toBe(false);
  });
  it('accepts only a single canonical key, no options, comments or injected lines', () => {
    expect(normalizeRemoteKey(key)).toBe(key);
    for (const bad of [`command="id" ${key}`, `${key}\n${key}`, `${key} comment`, key.replace('Nza', 'Aza')]) expect(() => normalizeRemoteKey(bad)).toThrow();
  });
  it('preserves existing authorization and removes only managed keys', () => {
    const original = '# existing devices\nssh-ed25519 existing-existing-device owner\n';
    const added = reconcileKeys(original, [{ id, public_key: key }]);
    expect(added.startsWith(original)).toBe(true);
    expect(reconcileKeys(added, [{ id, public_key: key }])).toBe(added);
    const removed = reconcileKeys(added, []);
    expect(removed.startsWith(original)).toBe(true);
    expect(removed).not.toContain(key);
    expect(() => reconcileKeys(added + '# BEGIN CUBEROOT REMOTE ACCESS\n', [])).toThrow();
    expect(() => reconcileKeys(key + ' manually-added\n', [{ id, public_key: key }])).toThrow();
  });
});
