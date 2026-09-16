import { describe, expect, it, vi } from 'vitest';
import type { WebSession } from '@cuberoot/shared/auth/web-session';
import { RecordPushController, type RecordPushPort } from '../src/native/record-push-controller';

const session = (uid: number): WebSession => ({ token: `token${uid}`, user: {
  uid, wcaId: null, name: 'Test', avatar: '', avatarSource: 'preset', avatarPreset: null, isAdmin: false,
} });
function setup() {
  const storage = new Map<string, string>();
  const status = { configured: true, enabled: true, clientId: 'cid' };
  const port: RecordPushPort = {
    storage: { getItem: async key => storage.get(key) ?? null,
      setItem: async (key, value) => { storage.set(key, value); },
      removeItem: async key => { storage.delete(key); } },
    appId: async () => 'me.cuberoot.app.debug',
    identity: () => ({ installationId: 'installation', secret: 'secret' }),
    request: vi.fn(async () => ({ enabled: true })),
    start: vi.fn(async () => status), status: async () => status, stop: vi.fn(async () => undefined),
  };
  return { controller: new RecordPushController(port), port, storage, status };
}
describe('Android record push lifecycle', () => {
  it('does not initialize when server configuration is absent', async () => {
    const { controller, port } = setup();
    vi.mocked(port.request).mockResolvedValue({ enabled: false });
    await controller.sync(session(1));
    expect(port.start).not.toHaveBeenCalled();
  });
  it('waits for asynchronous CID and refreshes without repeated registration', async () => {
    const { controller, port, status } = setup();
    status.clientId = '';
    await controller.sync(session(1));
    expect(vi.mocked(port.request).mock.calls.map(call => call[0])).toEqual(['GET']);
    status.clientId = 'ready';
    await controller.sync(session(1));
    await controller.sync(session(1));
    expect(vi.mocked(port.request).mock.calls.filter(call => call[0] === 'PUT')).toHaveLength(1);
  });
  it('keeps only device revocation credentials offline and retries before another account binds', async () => {
    const { controller, port, storage } = setup();
    await controller.sync(session(1));
    vi.mocked(port.request).mockImplementation(async method => {
      if (method === 'DELETE') throw new Error('offline');
      return { enabled: true };
    });
    await expect(controller.logout()).rejects.toThrow('offline');
    expect(JSON.parse(storage.get('record_push_device')!)).toMatchObject({ uid: 1, revoke: true });
    expect(storage.get('record_push_device')).not.toContain('token1');
    const previousCalls = vi.mocked(port.request).mock.calls.length;
    await controller.sync(session(1)); // Old render/poll cannot undo logout.
    expect(vi.mocked(port.request).mock.calls).toHaveLength(previousCalls);
    await expect(controller.sync(session(2))).rejects.toThrow('offline');
    vi.mocked(port.request).mockClear().mockResolvedValue({ enabled: true });
    await controller.sync(session(2));
    expect(vi.mocked(port.request).mock.calls.map(call => call[0])).toEqual(['DELETE', 'GET', 'PUT']);
    expect(vi.mocked(port.request).mock.calls[0][3]).toBeUndefined();
    expect(vi.mocked(port.request).mock.calls[2][3]).toBe('token2');
  });
  it('does not bind after logout while native consent is pending', async () => {
    const { controller, port, status } = setup();
    let complete!: (value: typeof status) => void;
    vi.mocked(port.start).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const login = controller.sync(session(1));
    await vi.waitFor(() => expect(port.start).toHaveBeenCalled());
    const logout = controller.logout();
    complete(status);
    await Promise.all([login, logout]);
    expect(vi.mocked(port.request).mock.calls.some(call => call[0] === 'PUT')).toBe(false);
  });
  it('revokes a binding when system notification permission is removed', async () => {
    const { controller, port, status, storage } = setup();
    await controller.sync(session(1));
    status.enabled = false;
    await controller.sync(session(1));
    expect(vi.mocked(port.request).mock.calls.at(-1)?.[0]).toBe('DELETE');
    expect(storage.size).toBe(0);
  });
});
