import { resolveWebRoute } from '../../lib/web-routes';

Page({
  data: {
    src: '',
  },

  onLoad() {
    const route = resolveWebRoute('timer');
    if (!route) return;

    wx.setNavigationBarTitle({ title: route.title });
    this.setData({ src: route.url });
  },
});
