import { openWebsitePageOnce } from '../../lib/navigation';
import { listWebTools } from '../../lib/web-routes';

Page({
  data: {
    tools: listWebTools(),
  },

  openTool(event: WechatMiniprogram.TouchEvent) {
    const key = event.currentTarget.dataset.key;
    openWebsitePageOnce(this, key, {
      failureMessage: '页面暂时无法打开',
      invalidMessage: '该功能暂不可用',
    });
  },
});
