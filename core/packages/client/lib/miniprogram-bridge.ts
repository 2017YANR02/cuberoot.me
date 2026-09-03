'use client';

import {
  loadWeChatJsSdk,
} from '@/lib/wechat-js-sdk';
import { MINI_PROGRAM_LOGOUT_MESSAGE } from '@cuberoot/shared/auth/web-session';

export interface MiniProgramNavigationApi {
  getEnv?(callback: (result: { miniprogram?: boolean }) => void): void;
  navigateBack?(options?: {
    delta?: number;
    fail?(error: { errMsg?: string }): void;
    success?(): void;
  }): void;
  navigateTo(options: {
    url: string;
    fail?(error: { errMsg?: string }): void;
    success?(): void;
  }): void;
  postMessage?(options: { data: unknown }): void;
}

interface MiniProgramWebViewSdk {
  miniProgram?: MiniProgramNavigationApi;
}

declare global {
  interface Window {
    __wxjs_environment?: string;
    tt?: MiniProgramWebViewSdk;
  }
}

const ENVIRONMENT_TIMEOUT_MS = 2_000;
const DOUYIN_JSSDK_SRC = '/vendor/douyin-webview-jssdk-1.2.0.js';
const SDK_LOAD_TIMEOUT_MS = 10_000;
let douyinSdkPromise: Promise<MiniProgramWebViewSdk | null> | null = null;

function supportsMiniProgramNavigation(
  sdk: MiniProgramWebViewSdk | null | undefined,
): sdk is MiniProgramWebViewSdk & { miniProgram: MiniProgramNavigationApi } {
  return typeof sdk?.miniProgram?.navigateTo === 'function';
}

function isDouyinWebViewCandidate(): boolean {
  if (typeof window === 'undefined') return false;
  return /toutiaomicroapp/i.test(window.navigator?.userAgent ?? '')
    || supportsMiniProgramNavigation(window.tt);
}

export function isMiniProgramWebView(): boolean {
  if (typeof window === 'undefined') return false;
  return window.__wxjs_environment === 'miniprogram'
    || /miniProgram|toutiaomicroapp/i.test(window.navigator?.userAgent ?? '');
}

/**
 * iOS WeChat does not consistently include `miniProgram` in its web-view user
 * agent. Treat WeChat as a candidate, then confirm through miniProgram.getEnv.
 */
export function mayUseMiniProgramBridge(): boolean {
  if (typeof window === 'undefined') return false;
  return isMiniProgramWebView()
    || /MicroMessenger|toutiaomicroapp/i.test(window.navigator?.userAgent ?? '')
    || supportsMiniProgramNavigation(window.tt)
    || supportsMiniProgramNavigation(window.wx)
    || supportsMiniProgramNavigation(window.jWeixin);
}

/**
 * Payment UI must fail closed in every possible Mini Program container. Some
 * iOS WeChat web-views omit the explicit Mini Program marker, so candidates
 * are restricted too instead of briefly exposing an external checkout.
 */
export function isMiniProgramCommerceRestricted(): boolean {
  return mayUseMiniProgramBridge();
}

export function getInstalledMiniProgramNavigationApi(): MiniProgramNavigationApi | null {
  if (typeof window === 'undefined') return null;
  return [window.tt, window.wx, window.jWeixin]
    .find(supportsMiniProgramNavigation)?.miniProgram ?? null;
}

async function loadDouyinJsSdk(): Promise<MiniProgramWebViewSdk | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  if (supportsMiniProgramNavigation(window.tt)) return window.tt;
  if (douyinSdkPromise) return douyinSdkPromise;

  douyinSdkPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    let settled = false;
    const finish = (): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(supportsMiniProgramNavigation(window.tt) ? window.tt : null);
    };
    const timeout = window.setTimeout(finish, SDK_LOAD_TIMEOUT_MS);
    script.src = DOUYIN_JSSDK_SRC;
    script.async = true;
    script.onload = finish;
    script.onerror = finish;
    try {
      document.head.appendChild(script);
    } catch {
      finish();
    }
  });
  return douyinSdkPromise;
}

export async function loadMiniProgramNavigationApi(): Promise<MiniProgramNavigationApi | null> {
  const installed = getInstalledMiniProgramNavigationApi();
  if (installed) return installed;
  if (isDouyinWebViewCandidate()) {
    return (await loadDouyinJsSdk())?.miniProgram ?? null;
  }
  return (
    await loadWeChatJsSdk(supportsMiniProgramNavigation)
  )?.miniProgram ?? null;
}

export async function confirmMiniProgramEnvironment(
  miniProgram: MiniProgramNavigationApi,
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

/** Keep the website and native Mini Program auth stores in sync after logout. */
export async function notifyMiniProgramLogout(): Promise<boolean> {
  if (!mayUseMiniProgramBridge()) return false;

  const miniProgram = await loadMiniProgramNavigationApi();
  if (!miniProgram || typeof miniProgram.postMessage !== 'function') return false;
  if (!isMiniProgramWebView() && !await confirmMiniProgramEnvironment(miniProgram)) return false;

  try {
    miniProgram.postMessage({ data: MINI_PROGRAM_LOGOUT_MESSAGE });
    miniProgram.navigateBack?.({ delta: 1 });
    return true;
  } catch {
    return false;
  }
}
