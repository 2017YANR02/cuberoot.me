declare const __MINI_PROGRAM_TARGET__: 'wechat' | 'douyin';
declare const tt: typeof wx | undefined;

export type MiniProgramTarget = 'wechat' | 'douyin';

export const MINI_PROGRAM_TARGET: MiniProgramTarget =
  typeof __MINI_PROGRAM_TARGET__ === 'string' ? __MINI_PROGRAM_TARGET__ : 'wechat';

export const MINI_PROGRAM_PROVIDER_NAME =
  typeof __MINI_PROGRAM_TARGET__ === 'string' && __MINI_PROGRAM_TARGET__ === 'douyin'
    ? '抖音'
    : '微信';
export const MINI_PROGRAM_LOGIN_ENDPOINT =
  typeof __MINI_PROGRAM_TARGET__ === 'string' && __MINI_PROGRAM_TARGET__ === 'douyin'
  ? '/auth/douyin/miniprogram'
  : '/auth/wechat/miniprogram';
export const MINI_PROGRAM_WEB_MARKER =
  typeof __MINI_PROGRAM_TARGET__ === 'string' && __MINI_PROGRAM_TARGET__ === 'douyin'
  ? 'douyin_redirect'
  : 'wechat_redirect';

export function isDouyinMiniProgram(): boolean {
  return typeof __MINI_PROGRAM_TARGET__ === 'string' && __MINI_PROGRAM_TARGET__ === 'douyin';
}

export function miniProgramApi(): typeof wx {
  // Mini Program sandboxes inject native API bindings, not necessarily globalThis.
  const api = typeof __MINI_PROGRAM_TARGET__ === 'string' && __MINI_PROGRAM_TARGET__ === 'douyin'
    ? (typeof tt === 'undefined' ? undefined : tt)
    : (typeof wx === 'undefined' ? undefined : wx);
  if (!api) throw new Error(`${MINI_PROGRAM_TARGET} Mini Program API unavailable`);
  return api;
}

export function isExternalHttpsUrl(value: string): boolean {
  return /^https:\/\//.test(value);
}

export async function openExternalUrl(url: string): Promise<boolean> {
  if (!isExternalHttpsUrl(url)) return false;
  const api = miniProgramApi() as typeof wx & {
    openUrl?: (options: {
      url: string;
      success?(): void;
      fail?(error: { errMsg?: string }): void;
    }) => void;
  };
  if (typeof api.openUrl !== 'function') {
    api.setClipboardData({ data: url });
    api.showModal({
      title: '请在浏览器打开',
      content: '绑定 WCA 需要使用系统浏览器，链接已复制。',
      showCancel: false,
    });
    return false;
  }
  return new Promise((resolve) => {
    api.openUrl!({ url, success: () => resolve(true), fail: () => resolve(false) });
  });
}

export function miniProgramNextTick(callback: () => void): void {
  if (typeof __MINI_PROGRAM_TARGET__ === 'string' && __MINI_PROGRAM_TARGET__ === 'douyin') {
    void Promise.resolve().then(callback);
    return;
  }
  try {
    miniProgramApi().nextTick(callback);
  } catch {
    callback();
  }
}

export function miniProgramOffNetworkStatusChange(
  listener: WechatMiniprogram.OffNetworkStatusChangeCallback,
): void {
  miniProgramApi().offNetworkStatusChange(listener);
}
