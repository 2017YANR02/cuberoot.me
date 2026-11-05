import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
const mocks = vi.hoisted(() => ({ query: vi.fn(), closeConnections: vi.fn() }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/documents/realtime.js', () => ({ collaborativeDocuments: { closeConnections: mocks.closeConnections } }));
vi.mock('@cuberoot/shared/admin', () => ({ BANNED_WCA_IDS: ['banned'] }));
vi.mock('../src/utils/recon_helpers.js', () => ({
  ADMIN_WCA_IDS: ['owner'], checkRateLimit: vi.fn(), requireAdmin: vi.fn(), requireAdminOrApiKey: vi.fn(),
  requireAuth: async (c: { req: { header: (key: string) => string | undefined } }) => {
    const key = c.req.header('Authorization'); if (!key) throw new Error('Authentication required');
    return { wcaId: key, isAdmin: key === 'admin' };
  },
  authenticateUser: async (key?: string) => key ? { wcaId: key, isAdmin: key === 'admin' } : null,
}));
import { documentRoutes } from '../src/routes/documents.js';
import { resolveDocumentAccess, type DocumentAccess, type DocumentRole } from '../src/documents/access.js';
const app = new Hono();
app.onError((error, c) => c.json({ error: error.message }, error.message === 'Authentication required' ? 401 : 500));
app.route('/v1', documentRoutes);
const id = '11111111-1111-1111-1111-111111111111';
const fixture = (): DocumentAccess => ({ id, title: 'Test', kind: 'document', owner_key: 'owner', created_at: '', updated_at: '', general_access: 'restricted', general_role: 'viewer', editors_can_share: false, editors_can_export: true, viewers_can_export: true, member_role: null });
let row: DocumentAccess;
const settings = { access: 'admins', role: 'commenter', editorsCanShare: false, editorsCanExport: true, viewersCanExport: false };
const put = (user?: string, body: unknown = settings) => app.request(`/v1/documents/${id}/sharing`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: user } : {}) }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks(); row = fixture();
  mocks.query.mockImplementation(async (sql: string, params: unknown[]) => {
    if (sql.includes('m.role AS member_role')) return [{ ...row, member_role: ['owner', 'editor', 'commenter', 'viewer'].includes(String(params[0])) ? params[0] : null }];
    if (sql.includes('editors_can_share = TRUE RETURNING id')) return row.editors_can_share ? [{ id }] : [];
    return [];
  });
});
describe('document access policy', () => {
  it('keeps existing files private without an administrator bypass', () => {
    expect(resolveDocumentAccess(fixture(), null)).toBeNull();
    expect(resolveDocumentAccess(fixture(), { wcaId: 'admin', name: 'Admin', isAdmin: true })).toBeNull();
  });
  it('evaluates the current administrator identity dynamically', () => {
    const data = { ...fixture(), general_access: 'admins' as const, general_role: 'editor' as const };
    expect(resolveDocumentAccess(data, { wcaId: 'u42', name: 'Admin', isAdmin: true })?.role).toBe('editor');
    expect(resolveDocumentAccess(data, { wcaId: 'u42', name: 'Former admin', isAdmin: false })).toBeNull();
    expect(resolveDocumentAccess(data, null)).toBeNull();
  });
  it.each(['viewer', 'commenter', 'editor'] as const)('allows anonymous link access as %s, without managing sharing', role => {
    expect(resolveDocumentAccess({ ...fixture(), general_access: 'anyone', general_role: role }, null)).toMatchObject({ role, canManage: false });
  });
  it('retains the strongest grant and never downgrades the owner', () => {
    const data = { ...fixture(), general_access: 'anyone' as const, general_role: 'editor' as const };
    const user = { wcaId: 'owner', name: 'Owner', isAdmin: false };
    expect(resolveDocumentAccess({ ...data, member_role: 'owner' }, user)).toMatchObject({ role: 'owner', canManage: true, canExport: true });
    expect(resolveDocumentAccess({ ...data, member_role: 'viewer' }, user)?.role).toBe('editor');
  });
  it.each(['editor', 'commenter', 'viewer'] as DocumentRole[])('applies export limits to %s', role => {
    const data = { ...fixture(), member_role: role, editors_can_export: false, viewers_can_export: false, editors_can_share: true };
    expect(resolveDocumentAccess(data, { wcaId: 'member', name: '', isAdmin: false })).toMatchObject({ canExport: false, canManage: role === 'editor' });
  });
  it('denies banned users even for publicly shared files', () => {
    expect(resolveDocumentAccess({ ...fixture(), general_access: 'anyone' }, { wcaId: 'banned', name: '', isAdmin: true })).toBeNull();
  });
});
describe('sharing route', () => {
  it('saves owner settings and disconnects live sessions to reauthenticate', async () => {
    expect((await put('owner')).status).toBe(200);
    expect(mocks.query.mock.calls[1][1]).toEqual(['admins', 'commenter', false, true, false, id]);
    expect(mocks.closeConnections).toHaveBeenCalledExactlyOnceWith(`document.${id}`);
  });
  it.each(['editor', 'commenter', 'viewer', 'admin'])('rejects unauthorized %s', async user => {
    expect((await put(user)).status).toBe(403);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });
  it('requires sign-in to manage sharing', async () => { expect((await put()).status).toBe(401); });
  it.each([null, {}, { ...settings, role: 'owner' }, { ...settings, access: 'invalid' }, { ...settings, editorsCanShare: 'yes' }])('rejects invalid settings %j', async body => {
    expect((await put('owner', body)).status).toBe(400);
    expect(mocks.closeConnections).not.toHaveBeenCalled();
  });
  it('allows delegated editors to change access but not owner restrictions', async () => {
    row.editors_can_share = true;
    expect((await put('editor', { access: 'anyone', role: 'viewer' })).status).toBe(200);
    expect(mocks.query.mock.calls[1][1]).toEqual(['anyone', 'viewer', id]);
    expect((await put('editor', { ...settings, editorsCanShare: false })).status).toBe(403);
  });
  it('does not report success or disconnect clients on persistence failure', async () => {
    mocks.query.mockResolvedValueOnce([{ ...fixture(), member_role: 'owner' }]).mockRejectedValueOnce(new Error('Write failed'));
    expect((await put('owner')).status).toBe(500);
    expect(mocks.closeConnections).not.toHaveBeenCalled();
  });
  it('serves anonymous metadata only when link access is enabled', async () => {
    expect((await app.request(`/v1/documents/${id}`)).status).toBe(404);
    row.general_access = 'anyone'; row.general_role = 'commenter';
    const response = await app.request(`/v1/documents/${id}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ document: { role: 'commenter' }, canManage: false });
  });
});
