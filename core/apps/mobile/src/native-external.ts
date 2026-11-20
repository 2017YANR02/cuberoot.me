import { AppLauncher } from '@capacitor/app-launcher';
import { Browser } from '@capacitor/browser';
import { isMobileEmbedExternalHref } from '@cuberoot/shared/mobile-embed';

export async function openNativeExternal(href: string, useSystemBrowser = false): Promise<void> {
  if (!isMobileEmbedExternalHref(href)) throw new Error('Unsupported external URL');
  const url = new URL(href);
  if (useSystemBrowser || url.protocol === 'mailto:') {
    // Attempt the launch directly: Android package visibility can make a
    // canOpenUrl preflight fail even when a mail handler is installed.
    const result = await AppLauncher.openUrl({ url: url.href });
    if (!result.completed) {
      throw new Error(url.protocol === 'mailto:' ? 'Could not open mail application' : 'Could not open external URL');
    }
    return;
  }
  await Browser.open({ url: url.href });
}
