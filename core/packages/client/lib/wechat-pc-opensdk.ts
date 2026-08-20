import { apiUrl } from '@/lib/api-base';

const SDK_SRC = 'https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxopensdk.js';
const SDK_LOAD_TIMEOUT_MS = 15_000;

export type WeChatShareScene = 'chat' | 'timeline';

interface WeChatOpenSdk {
  ready?: boolean;
  onReady?: () => void;
  shareLink(options: {
    url: string;
    txt: string;
    desc?: string;
    appid: string;
    thumburl: string;
    scene: WeChatShareScene;
    ticket: string;
    timeout?: number;
  }): unknown | Promise<unknown>;
}

declare global {
  interface Window {
    wxopensdk?: WeChatOpenSdk;
  }
}

interface TicketResponse {
  appId?: string;
  ticket?: string;
  disabled?: boolean;
}

export class WeChatPcShareError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'WeChatPcShareError';
  }
}

let sdkPromise: Promise<WeChatOpenSdk> | null = null;

function waitForSdkReady(): Promise<WeChatOpenSdk> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let deadline = 0;
    const finish = (sdk: WeChatOpenSdk) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(deadline);
      resolve(sdk);
    };
    deadline = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new WeChatPcShareError('sdk-timeout'));
    }, SDK_LOAD_TIMEOUT_MS);
    const inspect = () => {
      if (settled) return;
      const sdk = window.wxopensdk;
      if (!sdk) {
        window.setTimeout(inspect, 50);
        return;
      }
      if (sdk.ready) {
        finish(sdk);
        return;
      }
      const previous = sdk.onReady;
      sdk.onReady = () => {
        previous?.();
        finish(sdk);
      };
    };
    inspect();
  });
}

function loadSdk(): Promise<WeChatOpenSdk> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    if (window.wxopensdk) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    if (existing) {
      // 已有标签可能早已触发 load;直接进入 SDK 就绪轮询,避免永远等不到旧事件。
      resolve();
      return;
    }
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new WeChatPcShareError('sdk-load')), { once: true });
    if (!existing) {
      script.src = SDK_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  }).then(waitForSdkReady).catch((error) => {
    sdkPromise = null;
    throw error;
  });
  return sdkPromise;
}

async function requestOneTimeTicket(): Promise<{ appId: string; ticket: string }> {
  const response = await fetch(apiUrl('/v1/wechat/pc-opensdk-ticket'), {
    method: 'POST',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({})) as TicketResponse;
  if (payload.disabled) throw new WeChatPcShareError('disabled');
  if (!response.ok || !payload.appId || !payload.ticket) {
    throw new WeChatPcShareError(response.status === 429 ? 'rate-limit' : 'ticket');
  }
  return { appId: payload.appId, ticket: payload.ticket };
}

export function extractWeChatOpenSdkCode(result: unknown): number | undefined {
  if (typeof result === 'number') return result;
  if (!result || typeof result !== 'object') return undefined;
  const record = result as Record<string, unknown>;
  for (const key of ['errCode', 'err_code', 'code']) {
    if (typeof record[key] === 'number') return record[key];
  }
  return undefined;
}

function pageDescription(): string {
  return document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content
    || document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content
    || '';
}

export async function shareCurrentPageToWeChat(scene: WeChatShareScene): Promise<void> {
  if (typeof window === 'undefined') throw new WeChatPcShareError('environment');
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    throw new WeChatPcShareError('https');
  }

  // SDK 先就绪,再签发只能使用一次且 5 分钟过期的 ticket。
  const sdk = await loadSdk();
  const { appId, ticket } = await requestOneTimeTicket();
  const url = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  const result = await sdk.shareLink({
    url,
    txt: document.title || 'CubeRoot',
    desc: pageDescription(),
    appid: appId,
    thumburl: new URL('/icons/icon-512.png', window.location.origin).href,
    scene,
    ticket,
    timeout: 30_000,
  });
  const code = extractWeChatOpenSdkCode(result);
  if (code !== undefined && code !== 0) throw new WeChatPcShareError(`sdk-${code}`);
}
