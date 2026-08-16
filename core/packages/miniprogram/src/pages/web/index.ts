import { resolveWebRoute } from '../../lib/web-routes';

Page({
  data: { src: '' },

  onLoad(options: Record<string, string | undefined>) {
    const route = resolveWebRoute(options.key);
    if (!route) return;
    wx.setNavigationBarTitle({ title: route.title });
    this.setData({ src: route.url });
  },
});
