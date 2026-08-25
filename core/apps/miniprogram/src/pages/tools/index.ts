import {
  cancelWebsiteNavigation,
  openWebsitePageOnce,
} from '../../lib/navigation';
import { listWebTools, resolveToolsPageShare } from '../../lib/web-routes';

Page({
  data: {
    status: '',
    tools: listWebTools(),
  },

  onHide() {
    cancelWebsiteNavigation(this);
  },

  onUnload() {
    cancelWebsiteNavigation(this);
  },

  onShareAppMessage() {
    return resolveToolsPageShare();
  },

  openTool(event: WechatMiniprogram.TouchEvent) {
    const key = event.currentTarget.dataset.key;
    this.setData({ status: '' });
    openWebsitePageOnce(this, key, {
      failureMessage: '页面暂时无法打开',
      invalidMessage: '该功能暂不可用',
      onFailure: (status) => this.setData({ status }),
    });
  },
});
