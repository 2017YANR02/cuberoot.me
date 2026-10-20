import { describe, expect, it } from 'vitest';
import { UURemoteClient, type UURemoteRuntime } from './uu-remote';

function fixture() {
  const values = new Map<string, string>();
  const opened: URL[] = [];
  let serial = 0;
  const runtime: UURemoteRuntime = {
    storage: { getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); } },
    canOpen: async () => true,
    open: async url => { opened.push(new URL(url)); return true; },
    appId: async () => 'me.cuberoot.app', nonce: () => `request-${++serial}`, now: () => 1000,
  };
  const client = new UURemoteClient(runtime);
  const callback = (fields: Record<string, string>) => {
    const request = opened.at(-1)!;
    const url = new URL(request.searchParams.get('callback')!);
    if (request.searchParams.has('nonce')) url.searchParams.set('nonce', request.searchParams.get('nonce')!);
    Object.entries(fields).forEach(([key, value]) => url.searchParams.set(key, value));
    return url.href;
  };
  const bind = async () => { await client.start('bind'); await client.handleUrl(callback({ anonymous_device_id: 'opaque+/=&电脑' })); };
  return { client, runtime, opened, callback, bind };
}

describe('UU remote request lifecycle', () => {
  it('launches without a visibility preflight and handles an actually unavailable app', async () => {
    const f = fixture();
    delete f.runtime.canOpen;
    await f.client.start('bind');
    expect(f.opened).toHaveLength(1);
    expect(f.opened[0].pathname).toBe('/device/authorize');
    expect(f.client.getSnapshot()).toMatchObject({ pending: 'bind', message: 'waiting' });
    await f.client.cancel();
    f.runtime.open = async () => false;
    await f.client.start('bind');
    expect(f.client.getSnapshot()).toMatchObject({ pending: null, message: 'open_failed' });
  });
  it('binds with nonce, preserves opaque ID and launches fullscreen without waiting for callback', async () => {
    const f = fixture(); await f.bind();
    expect(f.client.getSnapshot().bound).toBe(true);
    await f.client.start('fullscreen');
    expect(f.opened.at(-1)!.searchParams.get('anonymous_device_id')).toBe('opaque+/=&电脑');
    expect(f.opened.at(-1)!.searchParams.get('window_type')).toBe('0');
    expect(f.opened.at(-1)!.searchParams.has('callback')).toBe(false);
    expect(f.client.getSnapshot()).toMatchObject({ pending: null, message: 'opened' });
  });
  it('recovers a pending bind after cold launch and ignores duplicate delivery', async () => {
    const f = fixture(); await f.client.start('bind');
    const url = f.callback({ anonymous_device_id: 'computer' });
    const fresh = new UURemoteClient(f.runtime);
    await fresh.handleUrl(url); await fresh.handleUrl(url.replace('computer', 'attacker'));
    await fresh.start('fullscreen');
    expect(f.opened.at(-1)!.searchParams.get('anonymous_device_id')).toBe('computer');
  });
  it('rejects wrong scheme, host, path, nonce, duplicates and conflicting result fields', async () => {
    const f = fixture(); await f.client.start('bind');
    const valid = f.callback({ anonymous_device_id: 'computer' });
    for (const invalid of [valid.replace('me.cuberoot.app:', 'other:'), valid.replace('uu-remote', 'auth'), valid.replace('/bind', '/control'), valid.replace('request-1', 'wrong'), `${valid}&nonce=request-1`, `${valid}&error=user_cancel`]) {
      await f.client.handleUrl(invalid);
      expect(f.client.getSnapshot()).toMatchObject({ bound: false, pending: 'bind' });
    }
    await f.client.handleUrl(valid);
    expect(f.client.getSnapshot().bound).toBe(true);
  });
  it('requires the current control request for PiP and preserves callbacks across restarts', async () => {
    const f = fixture(); await f.bind(); await f.client.start('pip');
    expect(f.opened.at(-1)!.searchParams.get('window_type')).toBe('1');
    const result = f.callback({ status: 'success' });
    await f.client.handleUrl(result.replace('request-2', 'wrong'));
    expect(f.client.getSnapshot().pending).toBe('control');
    const fresh = new UURemoteClient(f.runtime); await fresh.handleUrl(result);
    expect(fresh.getSnapshot()).toMatchObject({ bound: true, pending: null, message: 'connected' });
  });
  it('clears invalid bindings and offers fullscreen after unsupported PiP', async () => {
    const f = fixture(); await f.bind(); await f.client.start('pip');
    await f.client.handleUrl(f.callback({ status: 'failure', reason: 'pip_unsupported' }));
    expect(f.client.getSnapshot()).toMatchObject({ bound: true, message: 'pip_unsupported' });
    await f.client.start('pip');
    await f.client.handleUrl(f.callback({ status: 'failure', reason: 'device_not_found' }));
    expect(f.client.getSnapshot()).toMatchObject({ bound: false, pending: null });
  });
  it('cancel/forget invalidates delayed callbacks and failed rebind keeps the old computer', async () => {
    const f = fixture(); await f.bind(); await f.client.start('bind');
    await f.client.handleUrl(f.callback({ error: 'user_cancel' }));
    expect(f.client.getSnapshot().bound).toBe(true);
    await f.client.start('bind'); const late = f.callback({ anonymous_device_id: 'replacement' });
    await f.client.cancel(); await f.client.handleUrl(late);
    await f.client.start('fullscreen');
    expect(f.opened.at(-1)!.searchParams.get('anonymous_device_id')).toBe('opaque+/=&电脑');
    await f.client.forget(); await f.client.handleUrl(late);
    expect(f.client.getSnapshot().bound).toBe(false);
  });
  it('handles absent app and failed launch without retaining pending requests', async () => {
    const f = fixture(); f.runtime.canOpen = async () => false;
    await f.client.start('bind'); expect(f.opened).toHaveLength(0);
    expect(f.client.getSnapshot().message).toBe('not_installed');
    f.runtime.canOpen = async () => true; f.runtime.open = async () => false;
    await f.client.start('bind'); expect(f.client.getSnapshot()).toMatchObject({ pending: null, message: 'open_failed' });
  });
  it('serializes double taps, accepts unknown failures, rejects expired callbacks', async () => {
    const f = fixture(); await Promise.all([f.client.start('bind'), f.client.start('bind')]);
    expect(f.opened).toHaveLength(1);
    await f.client.handleUrl(f.callback({ error: 'future_error' }));
    expect(f.client.getSnapshot()).toMatchObject({ pending: null, message: 'connect_failed' });
    await f.client.start('bind'); const late = f.callback({ anonymous_device_id: 'computer' });
    f.runtime.now = () => 31 * 60_000; await f.client.handleUrl(late);
    expect(f.client.getSnapshot()).toMatchObject({ bound: false, pending: null, message: 'expired' });
  });
  it('fails closed on secure storage write failure before launching', async () => {
    const f = fixture(); f.runtime.storage.setItem = async () => { throw new Error('locked'); };
    await f.client.start('bind'); expect(f.opened).toHaveLength(0);
    expect(f.client.getSnapshot().message).toBe('failed');
  });
});
