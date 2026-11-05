import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
const mocks = vi.hoisted(() => ({ hooks: {} as Record<string, (...args: any[]) => Promise<any>>, query: vi.fn(), authenticate: vi.fn() }));
vi.mock('@hocuspocus/server', () => ({ Hocuspocus: class { constructor(config: typeof mocks.hooks) { mocks.hooks = config; } } }));
vi.mock('@hocuspocus/extension-database', () => ({ Database: class {} }));
vi.mock('../src/db/connection.js', () => ({ query: mocks.query }));
vi.mock('../src/utils/recon_helpers.js', () => ({ authenticateUser: mocks.authenticate }));
vi.mock('../src/utils/notify.js', () => ({ notify: vi.fn() }));
import '../src/documents/realtime.js';
let row: Record<string, unknown>;
const user = { wcaId: 'u42', name: 'Member', isAdmin: false };
beforeEach(() => {
  vi.clearAllMocks();
  row = { id: 'test', general_access: 'restricted', general_role: 'viewer', member_role: null, editors_can_share: false, editors_can_export: true, viewers_can_export: true };
  mocks.query.mockImplementation(async () => [row]);
  mocks.authenticate.mockResolvedValue(user);
});
afterEach(() => vi.useRealTimers());
describe('real-time sharing enforcement', () => {
  it('rejects anonymous access to a private document', async () => {
    await expect(mocks.hooks.onAuthenticate({ documentName: 'document.test', token: '', connectionConfig: {} })).rejects.toThrow('access denied');
  });
  it.each(['viewer', 'commenter', 'editor'])('authenticates an anonymous link %s with the correct write mode', async role => {
    row.general_access = 'anyone'; row.general_role = role;
    const connectionConfig: { readOnly?: boolean } = {};
    const context = await mocks.hooks.onAuthenticate({ documentName: 'document.test', token: '', connectionConfig });
    expect(context).toMatchObject({ role, token: '', isAdmin: false });
    expect(connectionConfig.readOnly).toBe(role === 'viewer');
  });
  it('downgrades an existing editor connection before handling another update', async () => {
    row.member_role = 'viewer';
    const context = { ...user, token: 'signed', role: 'editor' };
    const connection = { readOnly: false };
    await mocks.hooks.beforeSync({ documentName: 'document.test', context, connection, type: 0 });
    expect(connection.readOnly).toBe(true); expect(context.role).toBe('viewer');
  });
  it('rejects a formerly permitted connection after membership removal', async () => {
    await expect(mocks.hooks.beforeSync({ documentName: 'document.test', context: { ...user, token: 'signed', role: 'editor' }, connection: {}, type: 0 })).rejects.toThrow('access denied');
  });
  it('validates commenter sync updates before they reach the live document', async () => {
    row.member_role = 'commenter';
    const document = new Y.Doc(), client = new Y.Doc();
    client.getXmlFragment('default').insert(0, [new Y.XmlElement('paragraph')]);
    try {
      await expect(mocks.hooks.beforeSync({ documentName: 'document.test', context: { ...user, token: 'signed', role: 'commenter' }, connection: {}, document, type: 2, payload: Y.encodeStateAsUpdate(client) })).rejects.toThrow('cannot edit');
      expect(document.getXmlFragment('default').length).toBe(0);
    } finally { document.destroy(); client.destroy(); }
  });
  it('closes idle readers after revocation and cleans up its authorization timer', async () => {
    vi.useFakeTimers();
    const connection = { context: { ...user, token: 'signed', role: 'viewer' }, close: vi.fn() };
    await mocks.hooks.afterLoadDocument({ documentName: 'document.test', document: { getConnections: () => [connection] } });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(connection.close).toHaveBeenCalledTimes(1);
    await mocks.hooks.afterUnloadDocument({ documentName: 'document.test' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
