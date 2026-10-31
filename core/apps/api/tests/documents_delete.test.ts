import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({ query: vi.fn(), closeConnections: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/documents/realtime.js', () => ({ collaborativeDocuments: { closeConnections: mocks.closeConnections } }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  ADMIN_WCA_IDS: ['admin'],
  requireAuth: async (c: { req: { header: (key: string) => string | undefined } }) => {
    const user = c.req.header('Authorization');
    if (!user) throw new Error('Authentication required');
    return { wcaId: user, isAdmin: user === 'admin' };
  },
  requireAdmin: vi.fn(), requireAdminOrApiKey: vi.fn(), checkRateLimit: vi.fn(),
}));
import { documentRoutes } from '../src/routes/documents.js';

const app = new Hono();
app.onError((error, c) => c.json({ error: error.message }, error.message === 'Authentication required' ? 401 : 500));
app.route('/v1', documentRoutes);
const id = '11111111-1111-1111-1111-111111111111';
let resource: { id: string; owner: string; kind: string } | null;
const remove = (user?: string) => app.request(`/v1/documents/${id}`, {
  method: 'DELETE', headers: user ? { Authorization: user } : {},
});
beforeEach(() => {
  vi.clearAllMocks();
  resource = { id, owner: 'owner', kind: 'document' };
  mocks.query.mockImplementation(async (sql: string, params: unknown[]) => {
    expect(sql).toBe('DELETE FROM collaborative_documents WHERE id = ? AND owner_key = ? RETURNING id');
    if (resource?.id !== params[0] || resource?.owner !== params[1]) return [];
    resource = null;
    return [{ id }];
  });
});

describe('collaborative resource deletion', () => {
  it.each(['document', 'spreadsheet'])('allows only the owner to delete a %s and closes its live connections', async kind => {
    resource!.kind = kind;
    const response = await remove('owner');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(resource).toBeNull();
    expect(mocks.closeConnections).toHaveBeenCalledExactlyOnceWith(`document.${id}`);
    expect((await remove('owner')).status).toBe(404);
    expect(mocks.closeConnections).toHaveBeenCalledTimes(1);
  });
  it.each(['editor', 'viewer', 'stranger', 'admin'])('rejects %s even when bypassing the UI', async user => {
    expect((await remove(user)).status).toBe(404);
    expect(resource?.owner).toBe('owner');
    expect(mocks.closeConnections).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated requests before accessing data', async () => {
    expect((await remove()).status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.closeConnections).not.toHaveBeenCalled();
  });
  it('does not close live connections when persistence fails', async () => {
    mocks.query.mockRejectedValueOnce(new Error('Database unavailable'));
    expect((await remove('owner')).status).toBe(500);
    expect(resource?.id).toBe(id);
    expect(mocks.closeConnections).not.toHaveBeenCalled();
  });
});
