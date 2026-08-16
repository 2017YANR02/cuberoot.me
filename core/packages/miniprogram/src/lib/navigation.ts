import { resolveWebRoute } from './web-routes';
import { createPlatformActionGuard } from './platform-action-guard';

interface WebsitePageNavigationOptions {
  failureMessage: string;
  invalidMessage?: string;
}

const websiteNavigationGuard = createPlatformActionGuard();

function showNavigationMessage(title: string): void {
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
    if (options.invalidMessage) showNavigationMessage(options.invalidMessage);
    return false;
  }
  const attempt = websiteNavigationGuard.begin(owner);
  if (attempt === null) return false;

  const release = () => websiteNavigationGuard.settle(owner, attempt);
  const fail = () => {
    if (!release()) return;
    showNavigationMessage(options.failureMessage);
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
