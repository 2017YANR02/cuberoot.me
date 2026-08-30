import { cancelWebsiteNavigation, openWebsitePageOnce } from '../../lib/navigation';
import { showPublicShareMenu, toTimelineShare } from '../../lib/share';
import {
  resolveTimelineShareRoute,
  WEB_ROUTE_SHARE_IMAGE,
} from '../../lib/web-routes';

interface TimelineSharePageData {
  canShare: boolean;
  description: string;
  errorMessage: string;
  routeKey: string;
  title: string;
}

const fallbackShare = {
  imageUrl: WEB_ROUTE_SHARE_IMAGE,
  title: 'CubeRoot 魔方根',
  path: '/pages/timer/index',
};

Page<TimelineSharePageData, WechatMiniprogram.Page.CustomOption>({
  data: {
    canShare: false,
    description: '',
    errorMessage: '',
    routeKey: '',
    title: '分享到朋友圈',
  },

  onLoad(options) {
    const route = resolveTimelineShareRoute(options.key);
    if (!route) {
      try {
        wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
      } catch {
        // The invalid route remains blocked even when menu cleanup is unavailable.
      }
      this.setData({
        canShare: false,
        description: '',
        errorMessage: '该页面不支持分享到朋友圈。',
        routeKey: '',
        title: '无法分享',
      });
      return;
    }

    this.setData({
      canShare: true,
      description: route.description,
      errorMessage: '',
      routeKey: route.key,
      title: route.title,
    });
    showPublicShareMenu();
  },

  onShow() {
    if (resolveTimelineShareRoute(this.data.routeKey)) showPublicShareMenu();
  },

  onUnload() {
    cancelWebsiteNavigation(this);
  },

  onShareAppMessage() {
    return resolveTimelineShareRoute(this.data.routeKey)?.targetShare ?? fallbackShare;
  },

  onShareTimeline() {
    return toTimelineShare(
      resolveTimelineShareRoute(this.data.routeKey)?.timelineShare ?? fallbackShare,
    );
  },

  openRoute() {
    openWebsitePageOnce(this, this.data.routeKey, {
      failureMessage: '页面暂时无法打开',
      invalidMessage: '该页面地址无效',
      onFailure: (errorMessage) => this.setData({ errorMessage }),
    });
  },
});
