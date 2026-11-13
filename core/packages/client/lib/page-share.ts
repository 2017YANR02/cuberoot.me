import { publicPageSharePath } from '@cuberoot/shared/page-share';
import { confirmMiniProgramEnvironment, loadMiniProgramNavigationApi, mayUseMiniProgramBridge } from '@/lib/miniprogram-bridge';

export function currentPageShare(): { url: string; title: string } | null {
  const path = publicPageSharePath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  return path ? { url: `https://cuberoot.me${path}`, title: document.title || 'CubeRoot' } : null;
}

export async function syncMiniProgramPageShare(): Promise<void> {
  if (!mayUseMiniProgramBridge()) return;
  try {
    const api = await loadMiniProgramNavigationApi();
    if (!api?.postMessage || !await confirmMiniProgramEnvironment(api)) return;
    // Read after SDK loading: navigation may have happened while awaiting it.
    const share = currentPageShare();
    if (share) api.postMessage({ data: { type: 'cuberoot:page-share', path: share.url, title: share.title } });
  } catch { /* Optional metadata must never interrupt navigation. */ }
}

export { copyClipboardText as copyPageLink } from './clipboard';
