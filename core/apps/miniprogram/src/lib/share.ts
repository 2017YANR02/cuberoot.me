import type { WebRouteShare } from './web-routes';

export function showFriendShareMenu(): void {
  if (typeof wx.showShareMenu !== 'function') return;

  try {
    wx.showShareMenu({ menus: ['shareAppMessage'] });
  } catch {
    // Sharing is optional; page loading must survive unsupported platform APIs.
  }
}

export function showPublicShareMenu(): void {
  if (typeof wx.showShareMenu !== 'function') return;

  try {
    wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
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
