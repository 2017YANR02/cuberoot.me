export function setupAppUpdate(): void {
  if (typeof wx.getUpdateManager !== 'function') return;

  const updateManager = wx.getUpdateManager();
  updateManager.onUpdateReady(() => {
    wx.showModal({
      title: '新版本已准备好',
      content: '重启后即可使用最新版本。',
      confirmText: '立即重启',
      cancelText: '稍后',
      success(result) {
        if (result.confirm) updateManager.applyUpdate();
      },
    });
  });
  updateManager.onUpdateFailed(() => {
    wx.showToast({
      title: '更新失败，请稍后重试',
      icon: 'none',
    });
  });
}

App({
  onLaunch() {
    setupAppUpdate();
  },
  globalData: {},
});
