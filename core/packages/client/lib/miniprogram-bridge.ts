'use client';

import { sessionFetch } from '@/lib/session-fetch';
import {
  loadWeChatJsSdk,
} from '@/lib/wechat-js-sdk';
import { MINI_PROGRAM_LOGOUT_MESSAGE } from '@cuberoot/shared/auth/web-session';
import { apiUrl } from '@/lib/api-base';

export interface MiniProgramNavigationApi {
  switchTab?(options: { url: string }): void;
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
 * A WeChat browser or an installed JS-SDK is only a bridge candidate, not proof
 * of a Mini Program. Wait for getEnv when iOS omits the explicit marker; callers
 * keep checkout unavailable while this check is pending.
 */
export async function isMiniProgramCommerceRestricted(): Promise<boolean> {
  if (isMiniProgramWebView()) return true;
  if (!mayUseMiniProgramBridge()) return false;
  const miniProgram = await loadMiniProgramNavigationApi();
  return miniProgram ? confirmMiniProgramEnvironment(miniProgram) : false;
}

export function getInstalledMiniProgramNavigationApi(): MiniProgramNavigationApi | null {
  if (typeof window === 'undefined') return null;
  return [window.tt, window.wx, window.jWeixin]
    .find(supportsMiniProgramNavigation)?.miniProgram ?? null;
}

/** Route through a native adapter so returning within the active tab also works. */
export async function openMiniProgramHome(tab: 'tools' | 'account' = 'tools'): Promise<boolean> {
  return openMiniProgramTab(tab, tab === 'tools' ? '/' : undefined);
}

export async function openMiniProgramTab(tab: 'tools' | 'timer' | 'account', path?: string): Promise<boolean> {
  if (!mayUseMiniProgramBridge()) return false;
  const miniProgram = await loadMiniProgramNavigationApi();
  if (!miniProgram || !await confirmMiniProgramEnvironment(miniProgram)) return false;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (handled: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(handled);
    };
    const timeout = window.setTimeout(() => finish(false), SDK_LOAD_TIMEOUT_MS);
    try {
      miniProgram.navigateTo({
        url: `/pages/web/index?nativeTab=${tab}${path ? `&path=${encodeURIComponent(path)}` : ''}`,
        success: () => finish(true), fail: () => finish(false),
      });
    } catch { finish(false); }
  });
}

export function miniProgramTab(): string | null {
  try { return sessionStorage.getItem('cuberoot.native-tab'); } catch { return null; }
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

/** Start WCA linking in the system browser, then return to the native account page. */
export async function openMiniProgramWcaLink(sessionToken: string | null): Promise<boolean> {
  if (!sessionToken || !mayUseMiniProgramBridge()) return false;
  const miniProgram = await loadMiniProgramNavigationApi();
  if (!miniProgram || !await confirmMiniProgramEnvironment(miniProgram)) return false;
  try {
    const response = await sessionFetch(apiUrl('/v1/auth/wechat/wca-link/start'), {
      method: 'POST',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const data = await response.json().catch(() => ({})) as { ticket?: unknown; url?: unknown };
    if (!response.ok || typeof data.ticket !== 'string' || typeof data.url !== 'string') return false;
    const ticket = data.ticket;
    const url = data.url;
    return await new Promise<boolean>((resolve) => {
      miniProgram.navigateTo({
        url: `/pages/account/index?wcaLink=${encodeURIComponent(ticket)}&wcaUrl=${encodeURIComponent(url)}`,
        success: () => resolve(true),
        fail: () => resolve(false),
      });
    });
  } catch {
    return false;
  }
}

/** Native WeChat checkout accepts only an order ID; no token or return URL crosses the bridge. */
export async function openMiniProgramOrderPayment(orderId: string): Promise<boolean> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) return false;
  if (!mayUseMiniProgramBridge() || isDouyinWebViewCandidate()) return false;
  const miniProgram = await loadMiniProgramNavigationApi();
  if (!miniProgram || !await confirmMiniProgramEnvironment(miniProgram)) return false;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(ok);
    };
    const timeout = window.setTimeout(() => finish(false), SDK_LOAD_TIMEOUT_MS);
    try {
      miniProgram.navigateTo({
        url: `/pages/payment/index?orderId=${encodeURIComponent(orderId)}`,
        success: () => finish(true), fail: () => finish(false),
      });
    } catch { finish(false); }
  });
}
