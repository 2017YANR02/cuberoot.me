import { expect, it, vi } from 'vitest';
import type { InstalledAppHost } from '@cuberoot/app-ui';
import { withDesktopDistribution } from './distribution';

it('Store host cannot expose website EXE updates and retains existing membership/auth capabilities', () => {
  const original = { getWindowsUpdateInfo: vi.fn(), useAuth: vi.fn(), openExternal: vi.fn(), version: '0.1.0' } as unknown as InstalledAppHost;
  const store = withDesktopDistribution(original, 'microsoft-store', '1.2.3');
  expect(store.getWindowsUpdateInfo).toBeUndefined();
  expect(store.useAuth).toBe(original.useAuth);
  expect(store.openExternal).toBe(original.openExternal);
  expect(store.appleMembership).toBeUndefined();
  expect(store.googleMembership).toBeUndefined();
  expect(store.webMembership).toBeUndefined();
  expect(store.version).toBe('1.2.3');
  expect(original.getWindowsUpdateInfo).toBeTypeOf('function');
});

it('direct installs preserve their update adapter; unknown native channels fail closed', () => {
  const original = { getWindowsUpdateInfo: vi.fn() } as unknown as InstalledAppHost;
  expect(withDesktopDistribution(original, 'direct', '1.2.3').getWindowsUpdateInfo).toBe(original.getWindowsUpdateInfo);
  expect(() => withDesktopDistribution(original, 'unknown', '1.2.3')).toThrow('Unknown desktop distribution');
});
