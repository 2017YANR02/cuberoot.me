import { createPlatformActionGuard } from './lib/platform-action-guard';

export function setupAppUpdate(): void {
  if (typeof wx.getUpdateManager !== 'function') return;

  try {
    const updateManager = wx.getUpdateManager();
    const updatePrompts = createPlatformActionGuard();
    const updatePromptOwner = {};
    let updatePromptResolved = false;
    let updateFailureShown = false;
    updateManager.onUpdateReady(() => {
      if (updatePromptResolved || updatePrompts.isActive(updatePromptOwner)) return;
      const promptAttempt = updatePrompts.begin(updatePromptOwner);
      if (promptAttempt === null) {
        try {
          wx.showToast({
            title: '重开小程序更新',
            icon: 'none',
          });
        } catch {
          // The downloaded update remains available for the next cold launch.
        }
        return;
      }
      let updateApplyStarted = false;
      try {
        wx.showModal({
          title: '新版本已准备好',
          content: '重启后即可使用最新版本。',
          confirmText: '立即重启',
          cancelText: '稍后',
          success(result) {
            if (!updatePrompts.settle(updatePromptOwner, promptAttempt)) return;
            updatePromptResolved = true;
            if (!result.confirm || updateApplyStarted) return;
            updateApplyStarted = true;
            try {
              updateManager.applyUpdate();
            } catch {
              // The next cold launch will retry the update.
            }
          },
          fail() {
            updatePrompts.settle(updatePromptOwner, promptAttempt);
          },
        });
      } catch {
        updatePrompts.settle(updatePromptOwner, promptAttempt);
        // Update prompts must never block application launch or current work.
      }
    });
    updateManager.onUpdateFailed(() => {
      if (updateFailureShown) return;
      updateFailureShown = true;
      try {
        wx.showToast({
          title: '更新失败，请稍后重试',
          icon: 'none',
        });
      } catch {
        updateFailureShown = false;
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
