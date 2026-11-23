import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';

const ports = vi.hoisted(() => ({ open: vi.fn(), invoke: vi.fn(), isTauri: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: ports.invoke, isTauri: ports.isTauri }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: ports.open }));
import { openDesktopExternal } from './native-external';

beforeEach(() => vi.resetAllMocks());

it.each(['https://cuberoot.me/account', 'https://www.worldcubeassociation.org/', 'http://example.org/help', 'mailto:wrc@worldcubeassociation.org?subject=Rules%20question'])('opens supported external target %s', async href => {
  await openDesktopExternal(href);
  expect(ports.open).toHaveBeenCalledExactlyOnceWith(href);
});

it('normalizes URL casing before applying the native scope', async () => {
  await openDesktopExternal('HTTPS://CUBEROOT.ME/account');
  expect(ports.open).toHaveBeenCalledExactlyOnceWith('https://cuberoot.me/account');
});

it('keeps HTTP links in the macOS app and uses the system handler for email', async () => {
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)' });
  ports.isTauri.mockReturnValue(true);
  try {
    const href = 'https://www.worldcubeassociation.org/persons/2020TEST01?event=333#results';
    await openDesktopExternal(href);
    expect(ports.invoke).toHaveBeenCalledExactlyOnceWith('open_web_link', { href });
    expect(ports.open).not.toHaveBeenCalled();
    await openDesktopExternal('mailto:test@example.org');
    expect(ports.open).toHaveBeenCalledExactlyOnceWith('mailto:test@example.org');
  } finally {
    vi.unstubAllGlobals();
  }
});

it.each(['javascript:alert(1)', 'file:///etc/passwd', 'tel:123', 'me.cuberoot.app://auth/callback', 'intent://anything', '/account', 'https://example.org/' + 'x'.repeat(2048)])('rejects unsupported external target %s before native calls', async href => {
  await expect(openDesktopExternal(href)).rejects.toThrow('Unsupported external URL');
  expect(ports.open).not.toHaveBeenCalled();
});

it('propagates a native opener rejection for the existing host error feedback', async () => {
  ports.open.mockRejectedValueOnce(new Error('Native unavailable'));
  await expect(openDesktopExternal('mailto:test@example.org')).rejects.toThrow('Native unavailable');
});

it('grants only the three external URL protocols in the desktop capability', () => {
  const capability = JSON.parse(readFileSync(new URL('../src-tauri/capabilities/default.json', import.meta.url), 'utf8'));
  const opener = capability.permissions.filter((value: string | { identifier: string }) =>
    (typeof value === 'string' ? value : value.identifier).startsWith('opener:'));
  expect(opener).toEqual([{
    identifier: 'opener:allow-open-url',
    allow: [{ url: 'https://*' }, { url: 'http://*' }, { url: 'mailto:*' }],
  }]);
  expect(capability.local).toBe(true);
  expect(capability.windows).toEqual(['main']);
});
