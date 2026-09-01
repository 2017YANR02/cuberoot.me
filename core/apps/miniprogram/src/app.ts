import {
  createPlatformActionGuard,
  PLATFORM_INTERACTION_LOCK_TIMEOUT_MS,
} from './lib/platform-action-guard';
import { applyLocalizedTabBar, tr } from './lib/i18n';
import { miniProgramApi } from './lib/platform';

export function setupAppUpdate(): void {
  const api = miniProgramApi();
  if (typeof api.getUpdateManager !== 'function') return;

  try {
    const updateManager = api.getUpdateManager();
    const updatePrompts = createPlatformActionGuard(
      PLATFORM_INTERACTION_LOCK_TIMEOUT_MS,
    );
    const updatePromptOwner = {};
    let updatePromptResolved = false;
    let updateFailureShown = false;
    updateManager.onUpdateReady(() => {
      if (updatePromptResolved || updatePrompts.isActive(updatePromptOwner)) return;
      const promptAttempt = updatePrompts.begin(updatePromptOwner);
      if (promptAttempt === null) {
        try {
          api.showToast({
            title: tr({ en: 'Reopen to update', zh: '重开小程序更新' }),
            icon: 'none',
          });
        } catch {
          // The downloaded update remains available for the next cold launch.
        }
        return;
      }
      let updateApplyStarted = false;
      try {
        api.showModal({
          title: tr({ en: 'Update ready', zh: '新版本已准备好' }),
          content: tr({
            en: 'Restart now to use the latest version.',
            zh: '重启后即可使用最新版本。',
          }),
          confirmText: tr({ en: 'Restart', zh: '立即重启' }),
          cancelText: tr({ en: 'Later', zh: '稍后' }),
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
        api.showToast({
          title: tr({ en: 'Update failed. Try again later.', zh: '更新失败，请稍后重试' }),
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
    applyLocalizedTabBar();
    setupAppUpdate();
  },
  globalData: {},
});
