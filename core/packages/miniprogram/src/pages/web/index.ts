import {
  createWebViewPageData,
  markWebRouteFailed,
  openWebRoute,
  retryWebRoute,
} from '../../lib/web-view-page';

Page({
  data: createWebViewPageData(),

  onLoad(options: Record<string, string | undefined>) {
    void openWebRoute(this, options.key);
  },

  handleWebViewError() {
    markWebRouteFailed(this);
  },

  retry() {
    retryWebRoute(this);
  },
});
