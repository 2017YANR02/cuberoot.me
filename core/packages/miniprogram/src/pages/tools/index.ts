import { listWebTools, resolveWebRoute } from '../../lib/web-routes';

Page({
  data: {
    tools: listWebTools(),
  },

  openTool(event: WechatMiniprogram.TouchEvent) {
    const key = event.currentTarget.dataset.key;
    if (!resolveWebRoute(key)) {
      wx.showToast({ icon: 'none', title: '该功能暂不可用' });
      return;
    }
    wx.navigateTo({
      url: `/pages/web/index?key=${encodeURIComponent(String(key))}`,
      fail: () => {
        wx.showToast({ icon: 'none', title: '页面暂时无法打开' });
      },
    });
  },
});
