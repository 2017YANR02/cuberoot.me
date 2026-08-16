import { resolveWebRoute } from './web-routes';

interface WebsitePageNavigationOptions {
  failureMessage: string;
  invalidMessage?: string;
  success?: () => void;
}

const activeNavigations = new WeakSet<object>();

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
  if (activeNavigations.has(owner)) return false;

  activeNavigations.add(owner);
  const release = () => activeNavigations.delete(owner);
  const fail = () => {
    release();
    showNavigationMessage(options.failureMessage);
  };

  try {
    wx.navigateTo({
      url: `/pages/web/index?key=${encodeURIComponent(String(key))}`,
      success: options.success,
      fail,
      complete: release,
    });
  } catch {
    fail();
    return false;
  }
  return true;
}
