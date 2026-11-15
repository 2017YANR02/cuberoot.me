import { openUrl } from '@tauri-apps/plugin-opener';
import { isMobileEmbedExternalHref } from '@cuberoot/shared/mobile-embed';

export async function openDesktopExternal(href: string): Promise<void> {
  if (!isMobileEmbedExternalHref(href)) throw new Error('Unsupported external URL');
  await openUrl(new URL(href).href);
}
