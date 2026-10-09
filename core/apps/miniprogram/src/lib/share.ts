import type { WebRouteShare } from './web-routes';
import { isDouyinMiniProgram, miniProgramApi } from './platform';

function updateShareMenu(
  method: 'showShareMenu' | 'hideShareMenu',
  menus: WechatMiniprogram.ShowShareMenuOption['menus'],
): void {
  try {
    const api = miniProgramApi();
    if (typeof api[method] !== 'function') return;
    if (isDouyinMiniProgram()) {
      // Douyin names its native share action "share", not "shareAppMessage".
      const douyinApi = api as unknown as Record<typeof method, (options: { menus: ['share'] }) => void>;
      douyinApi[method]({ menus: ['share'] });
    } else if (method === 'showShareMenu') {
      api.showShareMenu({ menus });
    } else {
      api.hideShareMenu({ menus });
    }
  } catch {
    // Sharing is optional; page loading must survive unsupported platform APIs.
  }
}

export function showFriendShareMenu(): void {
  updateShareMenu('showShareMenu', ['shareAppMessage']);
}

export function showPublicShareMenu(): void {
  updateShareMenu('showShareMenu', ['shareAppMessage', 'shareTimeline']);
}

export function hidePublicShareMenu(): void {
  updateShareMenu('hideShareMenu', ['shareAppMessage', 'shareTimeline']);
}

export function toTimelineShare(
  share: WebRouteShare,
): WechatMiniprogram.Page.ICustomTimelineContent {
  const queryStart = share.path.indexOf('?');
  const query = queryStart >= 0 ? share.path.slice(queryStart + 1) : '';

  return {
    imageUrl: share.imageUrl,
    title: share.title,
    ...(query ? { query } : {}),
  };
}
