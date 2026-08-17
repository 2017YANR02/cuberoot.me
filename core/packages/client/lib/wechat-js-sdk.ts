'use client';

// Self-hosted so WeChat-only features do not depend on an external CDN.
const JWEIXIN_SRC = '/vendor/jweixin-1.6.0.js';
const LOAD_TIMEOUT_MS = 10_000;

export interface WeChatMiniProgramApi {
  navigateTo(options: {
    url: string;
    fail?(error: { errMsg?: string }): void;
  }): void;
}

export interface WeChatJsSdk {
  config(o: Record<string, unknown>): void;
  ready(cb: () => void): void;
  error(cb: (e: unknown) => void): void;
  updateAppMessageShareData(o: Record<string, unknown>): void;
  updateTimelineShareData(o: Record<string, unknown>): void;
  miniProgram?: WeChatMiniProgramApi;
}

export function supportsWeChatMiniProgramNavigation(
  sdk: WeChatJsSdk,
): sdk is WeChatJsSdk & { miniProgram: WeChatMiniProgramApi } {
  return typeof sdk.miniProgram?.navigateTo === 'function';
}

export function supportsWeChatShare(sdk: WeChatJsSdk): boolean {
  return typeof sdk.config === 'function'
    && typeof sdk.ready === 'function'
    && typeof sdk.error === 'function'
    && typeof sdk.updateAppMessageShareData === 'function'
    && typeof sdk.updateTimelineShareData === 'function';
}

declare global {
  interface Window {
    wx?: WeChatJsSdk;
  }
}

let sdkPromise: Promise<WeChatJsSdk | null> | null = null;

/** Load the shared WeChat JS-SDK once, optionally requiring a caller-specific capability. */
export function loadWeChatJsSdk(
  supports: (sdk: WeChatJsSdk) => boolean = () => true,
): Promise<WeChatJsSdk | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  if (window.wx && supports(window.wx)) return Promise.resolve(window.wx);
  if (sdkPromise) {
    return sdkPromise.then((sdk) => (sdk && supports(sdk) ? sdk : null));
  }

  sdkPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    let settled = false;
    const finish = (sdk: WeChatJsSdk | null): void => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      try {
        script.remove?.();
      } catch {
        // The SDK has already loaded or failed; a hostile DOM shim must not strand callers.
      }
      resolve(sdk);
    };
    const timeout = window.setTimeout(() => finish(null), LOAD_TIMEOUT_MS);
    script.src = JWEIXIN_SRC;
    script.async = true;
    script.onload = () => finish(window.wx ?? null);
    script.onerror = () => finish(null);
    try {
      document.head.appendChild(script);
    } catch {
      finish(null);
    }
  });
  const pending = sdkPromise;
  void pending.then(() => {
    if (sdkPromise === pending) sdkPromise = null;
  });
  return pending.then((sdk) => (sdk && supports(sdk) ? sdk : null));
}
