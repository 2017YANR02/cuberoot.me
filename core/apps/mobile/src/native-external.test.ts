import { beforeEach, expect, it, vi } from 'vitest';

const ports = vi.hoisted(() => ({ browser: vi.fn(), launcher: vi.fn() }));
vi.mock('@capacitor/browser', () => ({ Browser: { open: ports.browser } }));
vi.mock('@capacitor/app-launcher', () => ({ AppLauncher: { openUrl: ports.launcher } }));
import { openNativeExternal } from './native-external';

beforeEach(() => {
  vi.resetAllMocks();
  ports.launcher.mockResolvedValue({ completed: true });
});

it.each(['https://www.worldcubeassociation.org/persons/2020TEST01', 'http://example.org/help'])('opens website %s in Browser', async href => {
  await openNativeExternal(href);
  expect(ports.browser).toHaveBeenCalledExactlyOnceWith({ url: href });
  expect(ports.launcher).not.toHaveBeenCalled();
});

it('opens mail through the system handler, preserving address and query', async () => {
  const href = 'mailto:wrc@worldcubeassociation.org?subject=Rules%20question';
  await openNativeExternal(href);
  expect(ports.launcher).toHaveBeenCalledExactlyOnceWith({ url: href });
  expect(ports.browser).not.toHaveBeenCalled();
});

it('normalizes a mixed-case mail scheme before calling the native handler', async () => {
  await openNativeExternal('MAILTO:yrmfxc@gmail.com');
  expect(ports.launcher).toHaveBeenCalledExactlyOnceWith({ url: 'mailto:yrmfxc@gmail.com' });
});

it('reports an unavailable mail handler without opening Browser or claiming success', async () => {
  ports.launcher.mockResolvedValueOnce({ completed: false });
  await expect(openNativeExternal('mailto:test@example.org')).rejects.toThrow('Could not open mail application');
  expect(ports.browser).not.toHaveBeenCalled();
});

it('propagates native launch failure for the existing host error feedback', async () => {
  ports.launcher.mockRejectedValueOnce(new Error('Native unavailable'));
  await expect(openNativeExternal('mailto:test@example.org')).rejects.toThrow('Native unavailable');
});

it.each(['javascript:alert(1)', 'file:///etc/passwd', 'tel:123', 'me.cuberoot.app://auth/callback', 'intent://anything', '/account', 'https://example.org/' + 'x'.repeat(2048)])('rejects unsupported external target %s before native calls', async href => {
  await expect(openNativeExternal(href)).rejects.toThrow('Unsupported external URL');
  expect(ports.browser).not.toHaveBeenCalled();
  expect(ports.launcher).not.toHaveBeenCalled();
});
