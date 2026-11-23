import { invoke, isTauri } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { isMobileEmbedExternalHref } from '@cuberoot/shared/mobile-embed';

export async function openDesktopExternal(href: string): Promise<void> {
  if (!isMobileEmbedExternalHref(href)) throw new Error('Unsupported external URL');
  const url = new URL(href);
  if (url.protocol !== 'mailto:' && isTauri() && navigator.userAgent.includes('Macintosh')) {
    await invoke('open_web_link', { href: url.href });
    return;
  }
  await openUrl(url.href);
}
