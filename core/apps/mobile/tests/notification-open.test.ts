import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ platform: 'ios', native: vi.fn(), app: vi.fn(), pending: vi.fn(), launch: vi.fn(), remove: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => m.platform }, registerPlugin: () => ({
  addListener: m.native, pendingNotification: m.pending,
}) }));
vi.mock('@capacitor/app', () => ({ App: { addListener: m.app, getLaunchUrl: m.launch } }));
import { addNotificationOpenListener } from '../src/native/notification-open';
import { notificationOpenUrl } from '@cuberoot/shared/notification-push';
const tap = { kind: 'comp_announcement' as const, notificationId: '42', recipientUid: '7', link: '/wca/comp/Test2026' };
beforeEach(() => {
  vi.clearAllMocks();
  m.native.mockResolvedValue({ remove: m.remove }); m.app.mockResolvedValue({ remove: m.remove });
  m.pending.mockResolvedValue({ notification: tap }); m.launch.mockResolvedValue({ url: notificationOpenUrl('me.cuberoot.app', tap) });
});
describe('native notification handoff', () => {
  it('attaches before reading iOS cold state and forwards foreground taps without opening a browser', async () => {
    m.platform = 'ios'; const listener = vi.fn();
    const handle = await addNotificationOpenListener(listener);
    expect(m.native.mock.invocationCallOrder[0]).toBeLessThan(m.pending.mock.invocationCallOrder[0]);
    expect(listener).toHaveBeenCalledWith(tap);
    m.native.mock.calls[0][1]({ ...tap, notificationId: '43' });
    m.native.mock.calls[0][1]({ ...tap, link: 'https://evil.test' });
    expect(listener).toHaveBeenCalledTimes(2);
    await handle.remove(); expect(m.remove).toHaveBeenCalledTimes(1);
  });
  it('uses the same Android callback for cold intents and appUrlOpen, excluding auth callbacks', async () => {
    m.platform = 'android'; const listener = vi.fn();
    const handle = await addNotificationOpenListener(listener);
    expect(m.app.mock.invocationCallOrder[0]).toBeLessThan(m.launch.mock.invocationCallOrder[0]);
    expect(listener).toHaveBeenCalledWith(tap);
    m.app.mock.calls[0][1]({ url: notificationOpenUrl('me.cuberoot.app.debug', { ...tap, notificationId: '43' }) });
    m.app.mock.calls[0][1]({ url: 'me.cuberoot.app://auth/callback?ticket=ignored' });
    expect(listener).toHaveBeenCalledTimes(2);
    await handle.remove(); expect(m.remove).toHaveBeenCalledTimes(1);
  });
  it('cleans up a listener if cold-state reading fails', async () => {
    m.platform = 'ios'; m.pending.mockRejectedValueOnce(new Error('unavailable'));
    await expect(addNotificationOpenListener(vi.fn())).rejects.toThrow('unavailable');
    expect(m.remove).toHaveBeenCalledTimes(1);
  });
});
