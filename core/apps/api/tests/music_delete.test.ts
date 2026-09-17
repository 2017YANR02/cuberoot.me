import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({ query: vi.fn(), unlink: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('node:fs', async importOriginal => {
  const original = await importOriginal<typeof import('node:fs')>();
  return { ...original, promises: { ...original.promises, unlink: mocks.unlink } };
});
vi.mock('../src/utils/membership.js', () => ({ hasActiveMembership: async (role: string) => role === 'member' }));
vi.mock('../src/utils/app_user_auth.js', () => ({ requireAppUserId: async () => 7 }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  requireAuth: async (c: { req: { header: (key: string) => string | undefined } }) => {
    const role = c.req.header('Authorization');
    if (!role) throw new Error('Authentication required');
    return { wcaId: role, isAdmin: role === 'admin' };
  },
  requireAdmin: async (c: { req: { header: (key: string) => string | undefined } }) => {
    if (c.req.header('Authorization') !== 'admin') throw new Error('Admin access required');
  },
  optionalAuth: vi.fn(), checkRateLimit: vi.fn(),
}));
import { musicRoutes } from '../src/routes/music.js';

const app = new Hono();
app.onError((error, c) => c.json({ error: error.message }, error.message.includes('Authentication') ? 401 : 403));
app.route('/v1', musicRoutes);
const id = '11111111-1111-1111-1111-111111111111';
const remove = (role?: string, adminRoute = false) => app.request(`/v1/music/${adminRoute ? 'admin/' : ''}tracks/${id}`, {
  method: 'DELETE', headers: role ? { Authorization: role } : {},
});
let row: { id: string; owner_user_id: number; status: string; audio_storage_key: string; cover_storage_key: string | null } | null;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.unlink.mockResolvedValue(undefined);
  row = { id, owner_user_id: 7, status: 'published', audio_storage_key: `audio/${id}.mp3`, cover_storage_key: `covers/${id}.webp` };
  mocks.query.mockImplementation(async (sql: string, params: unknown[]) => {
    expect(sql).toMatch(/^DELETE FROM music_tracks WHERE id = \?/);
    if (!row || row.id !== params[0] || (sql.includes('owner_user_id = ?') && row.owner_user_id !== params[1])) return [];
    const deleted = row;
    row = null;
    return [deleted];
  });
});

describe('member music deletion', () => {
  it.each(['published', 'pending', 'rejected'])('deletes an owned %s upload and both stored files', async status => {
    row!.status = status;
    const response = await remove('member');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining('WHERE id = ? AND owner_user_id = ?'), [id, 7]);
    expect(mocks.unlink.mock.calls.map(([file]) => file.replaceAll('\\', '/').split('/').slice(-2).join('/'))).toEqual([`audio/${id}.mp3`, `covers/${id}.webp`]);
    expect((await remove('member')).status).toBe(404);
    expect(mocks.unlink).toHaveBeenCalledTimes(2);
  });
  it.each([undefined, 'ordinary', 'expired'])('rejects a non-member (%s) before touching records or files', async role => {
    expect((await remove(role)).status).toBe(role ? 403 : 401);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.unlink).not.toHaveBeenCalled();
  });
  it.each(['published', 'pending', 'rejected'])('cannot delete another account’s %s upload', async status => {
    row!.owner_user_id = 8;
    row!.status = status;
    expect((await remove('member')).status).toBe(404);
    expect(row?.owner_user_id).toBe(8);
    expect(mocks.unlink).not.toHaveBeenCalled();
  });
  it('returns 404 for a missing track without touching files', async () => {
    row = null;
    expect((await remove('member')).status).toBe(404);
    expect(mocks.unlink).not.toHaveBeenCalled();
  });
  it('handles an upload without a cover', async () => {
    row!.cover_storage_key = null;
    expect((await remove('member')).status).toBe(200);
    expect(mocks.unlink).toHaveBeenCalledTimes(1);
  });
  it('keeps the administrator endpoint privileged and able to delete other owners’ tracks', async () => {
    row!.owner_user_id = 8;
    expect((await remove('member', true)).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
    expect((await remove('admin', true)).status).toBe(200);
    expect(mocks.query).toHaveBeenCalledWith(expect.not.stringContaining('AND owner_user_id = ?'), [id]);
    expect(mocks.unlink).toHaveBeenCalledTimes(2);
  });
});
