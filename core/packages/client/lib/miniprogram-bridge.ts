'use client';

import {
  loadWeChatJsSdk,
  supportsWeChatMiniProgramNavigation,
  type WeChatMiniProgramApi,
} from '@/lib/wechat-js-sdk';

declare global {
  interface Window {
    __wxjs_environment?: string;
  }
}

const ENVIRONMENT_TIMEOUT_MS = 2_000;
const NAVIGATION_TIMEOUT_MS = 4_000;

export function isMiniProgramWebView(): boolean {
  if (typeof window === 'undefined') return false;
  return window.__wxjs_environment === 'miniprogram'
    || /miniProgram/i.test(window.navigator?.userAgent ?? '');
}

/**
 * iOS WeChat does not consistently include `miniProgram` in its web-view user
 * agent. Treat WeChat as a candidate, then confirm through miniProgram.getEnv.
 */
export function mayUseMiniProgramBridge(): boolean {
  if (typeof window === 'undefined') return false;
  return isMiniProgramWebView()
    || /MicroMessenger/i.test(window.navigator?.userAgent ?? '')
    || Boolean(window.wx && supportsWeChatMiniProgramNavigation(window.wx))
    || Boolean(window.jWeixin && supportsWeChatMiniProgramNavigation(window.jWeixin));
}

export function getInstalledMiniProgramNavigationApi(): WeChatMiniProgramApi | null {
  if (typeof window === 'undefined') return null;
  const installed = [window.wx, window.jWeixin].find(
    (sdk) => Boolean(sdk && supportsWeChatMiniProgramNavigation(sdk)),
  );
  if (installed && supportsWeChatMiniProgramNavigation(installed)) {
    return installed.miniProgram;
  }
  return null;
}

export async function loadMiniProgramNavigationApi(): Promise<WeChatMiniProgramApi | null> {
  const installed = getInstalledMiniProgramNavigationApi();
  if (installed) return installed;
  return (
    await loadWeChatJsSdk(supportsWeChatMiniProgramNavigation)
  )?.miniProgram ?? null;
}

export async function confirmMiniProgramEnvironment(
  miniProgram: WeChatMiniProgramApi,
): Promise<boolean> {
  if (isMiniProgramWebView()) return true;
  const getEnv = miniProgram.getEnv;
  if (typeof getEnv !== 'function') return false;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (inMiniProgram: boolean): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(inMiniProgram);
    };
    const timeout = window.setTimeout(() => finish(false), ENVIRONMENT_TIMEOUT_MS);
    try {
      getEnv.call(miniProgram, (result) => finish(result.miniprogram === true));
    } catch {
      finish(false);
    }
  });
}

export async function resolveVerifiedMiniProgramNavigationApi(): Promise<WeChatMiniProgramApi | null> {
  if (!mayUseMiniProgramBridge()) return null;
  const miniProgram = await loadMiniProgramNavigationApi();
  if (!miniProgram) return null;
  return (await confirmMiniProgramEnvironment(miniProgram)) ? miniProgram : null;
}

export function navigateToMiniProgramPage(
  miniProgram: WeChatMiniProgramApi,
  url: string,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (succeeded: boolean): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(succeeded);
    };
    const timeout = window.setTimeout(() => finish(false), NAVIGATION_TIMEOUT_MS);
    try {
      miniProgram.navigateTo({
        url,
        fail: () => finish(false),
        success: () => finish(true),
      });
    } catch {
      finish(false);
    }
  });
}
