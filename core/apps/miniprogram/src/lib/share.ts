import type { WebRouteShare } from './web-routes';
import { isDouyinMiniProgram, miniProgramApi } from './platform';

export function showFriendShareMenu(): void {
  const api = miniProgramApi();
  if (typeof api.showShareMenu !== 'function') return;

  try {
    api.showShareMenu({ menus: ['shareAppMessage'] });
  } catch {
    // Sharing is optional; page loading must survive unsupported platform APIs.
  }
}

export function showPublicShareMenu(): void {
  const api = miniProgramApi();
  if (typeof api.showShareMenu !== 'function') return;

  try {
    api.showShareMenu({
      menus: isDouyinMiniProgram() ? ['shareAppMessage'] : ['shareAppMessage', 'shareTimeline'],
    });
  } catch {
    // Sharing is optional; page loading must survive unsupported platform APIs.
  }
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
