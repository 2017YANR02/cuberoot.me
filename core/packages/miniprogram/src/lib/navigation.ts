import { resolveWebRoute } from './web-routes';

interface WebsitePageNavigationOptions {
  failureMessage: string;
  invalidMessage?: string;
}

const NAVIGATION_LOCK_TIMEOUT_MS = 5_000;
const activeNavigations = new WeakMap<object, object>();

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

  const attempt = {};
  activeNavigations.set(owner, attempt);
  let releaseTimer: number | undefined;
  const release = () => {
    if (releaseTimer !== undefined) clearTimeout(releaseTimer);
    if (activeNavigations.get(owner) === attempt) activeNavigations.delete(owner);
  };
  const fail = () => {
    release();
    showNavigationMessage(options.failureMessage);
  };
  releaseTimer = setTimeout(release, NAVIGATION_LOCK_TIMEOUT_MS);

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
