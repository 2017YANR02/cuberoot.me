import type { InstalledAppHost } from '@cuberoot/app-ui';

/** Native build channel, never inferred from the website, account or user agent. */
export function withDesktopDistribution(host: InstalledAppHost, channel: string, version: string): InstalledAppHost {
  if (channel !== 'direct' && channel !== 'microsoft-store') throw new Error('Unknown desktop distribution');
  if (channel === 'direct') return { ...host, version };
  // MSIX updates are managed by the Store; do not offer the website's EXE feed.
  const { getWindowsUpdateInfo: _websiteUpdates, ...storeHost } = host;
  return { ...storeHost, version };
}
