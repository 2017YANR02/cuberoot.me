import {
  cancelWebsiteNavigation,
  openWebsitePageOnce,
} from '../../lib/navigation';
import {
  listWebToolGroups,
  listWebTools,
  resolveToolsPageShare,
  resolveWebTool,
} from '../../lib/web-routes';
import { showPublicShareMenu, toTimelineShare } from '../../lib/share';

function inputValue(event: { detail?: { value?: unknown } }): string {
  return typeof event.detail?.value === 'string' ? event.detail.value : '';
}

Page({
  data: {
    groups: listWebToolGroups(),
    query: '',
    resultCount: listWebTools().length,
    status: '',
    statusTone: 'error',
    totalCount: listWebTools().length,
  },

  onShow() {
    showPublicShareMenu();
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

  onShareTimeline() {
    return toTimelineShare(resolveToolsPageShare());
  },

  handleSearchInput(event: { detail?: { value?: unknown } }) {
    const query = inputValue(event);
    const groups = listWebToolGroups(query);
    this.setData({
      groups,
      query,
      resultCount: groups.reduce((total, group) => total + group.tools.length, 0),
      status: '',
    });
  },

  clearSearch() {
    const groups = listWebToolGroups();
    this.setData({
      groups,
      query: '',
      resultCount: listWebTools().length,
      status: '',
    });
  },

  openTool(event: WechatMiniprogram.TouchEvent) {
    const tool = resolveWebTool(event.currentTarget.dataset.id);
    this.setData({ status: '', statusTone: 'error' });
    if (!tool) {
      wx.showToast({ icon: 'none', title: '该功能暂不可用' });
      return;
    }
    if (tool.action === 'disabled') {
      this.setData({ status: tool.actionLabel });
      return;
    }
    if (tool.action === 'copy') {
      try {
        wx.setClipboardData({
          data: tool.href,
          success: () => this.setData({ status: 'GitHub 地址已复制', statusTone: 'ready' }),
          fail: () => this.setData({ status: '链接复制失败，请稍后重试', statusTone: 'error' }),
        });
      } catch {
        this.setData({ status: '链接复制失败，请稍后重试', statusTone: 'error' });
      }
      return;
    }
    if (tool.action === 'native') {
      try {
        wx.switchTab({
          url: '/pages/timer/index',
          fail: () => this.setData({ status: '计时页暂时无法打开', statusTone: 'error' }),
        });
      } catch {
        this.setData({ status: '计时页暂时无法打开', statusTone: 'error' });
      }
      return;
    }
    openWebsitePageOnce(this, tool.key, {
      failureMessage: '页面暂时无法打开',
      invalidMessage: '该功能暂不可用',
      onFailure: (status) => this.setData({ status, statusTone: 'error' }),
    });
  },
});
