import {
  createWebViewPageData,
  markWebRouteFailed,
  openWebRoute,
  retryWebRoute,
} from '../../lib/web-view-page';

Page({
  data: createWebViewPageData(),

  onLoad() {
    void openWebRoute(this, 'timer');
  },

  handleWebViewError() {
    markWebRouteFailed(this);
  },

  retry() {
    retryWebRoute(this);
  },
});
