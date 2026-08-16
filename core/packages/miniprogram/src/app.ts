export function setupAppUpdate(): void {
  if (typeof wx.getUpdateManager !== 'function') return;

  try {
    const updateManager = wx.getUpdateManager();
    let updatePromptHandled = false;
    updateManager.onUpdateReady(() => {
      if (updatePromptHandled) return;
      updatePromptHandled = true;
      let updateApplyStarted = false;
      try {
        wx.showModal({
          title: '新版本已准备好',
          content: '重启后即可使用最新版本。',
          confirmText: '立即重启',
          cancelText: '稍后',
          success(result) {
            if (!result.confirm || updateApplyStarted) return;
            updateApplyStarted = true;
            try {
              updateManager.applyUpdate();
            } catch {
              // The next cold launch will retry the update.
            }
          },
          fail() {
            updatePromptHandled = false;
          },
        });
      } catch {
        updatePromptHandled = false;
        // Update prompts must never block application launch or current work.
      }
    });
    updateManager.onUpdateFailed(() => {
      try {
        wx.showToast({
          title: '更新失败，请稍后重试',
          icon: 'none',
        });
      } catch {
        // This notification is informational; keep the current version usable.
      }
    });
  } catch {
    // Older or partially initialized runtimes can reject update-manager setup.
  }
}

App({
  onLaunch() {
    setupAppUpdate();
  },
  globalData: {},
});
