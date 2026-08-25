import { resolveWebRoute } from './web-routes';
import { createPlatformActionGuard } from './platform-action-guard';

interface WebsitePageNavigationOptions {
  failureMessage: string;
  invalidMessage?: string;
  onFailure?: (message: string) => void;
}

const websiteNavigationGuard = createPlatformActionGuard();

export function cancelWebsiteNavigation(owner: object): void {
  websiteNavigationGuard.cancel(owner);
}

function showNavigationMessage(
  title: string,
  onFailure?: (message: string) => void,
): void {
  try {
    onFailure?.(title);
  } catch {
    // Persistent feedback is optional; keep the shared navigation path usable.
  }
  try {
    wx.showToast({ icon: 'none', title });
  } catch {
    // Feedback is secondary; navigation state must still be released correctly.
  }
}

export function openWebsitePageOnce(
  owner: object,
  key: unknown,
  options: WebsitePageNavigationOptions,
): boolean {
  const route = resolveWebRoute(key);
  if (!route) {
    if (options.invalidMessage) {
      showNavigationMessage(options.invalidMessage, options.onFailure);
    }
    return false;
  }
  if (websiteNavigationGuard.isActive(owner)) return false;
  const attempt = websiteNavigationGuard.begin(owner);
  if (attempt === null) {
    showNavigationMessage(options.failureMessage, options.onFailure);
    return false;
  }

  const release = () => websiteNavigationGuard.settle(owner, attempt);
  const fail = () => {
    if (!release()) return;
    showNavigationMessage(options.failureMessage, options.onFailure);
  };

  try {
    wx.navigateTo({
      url: `/pages/web/index?key=${encodeURIComponent(String(key))}`,
      fail,
      complete: release,
    });
  } catch {
    fail();
    return false;
  }
  return true;
}
