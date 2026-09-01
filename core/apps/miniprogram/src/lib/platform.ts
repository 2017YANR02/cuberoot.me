declare const __MINI_PROGRAM_TARGET__: 'wechat' | 'douyin';

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
  const runtime = globalThis as typeof globalThis & {
    tt?: typeof wx;
    wx?: typeof wx;
  };
  const api = typeof __MINI_PROGRAM_TARGET__ === 'string' && __MINI_PROGRAM_TARGET__ === 'douyin'
    ? runtime.tt
    : runtime.wx;
  if (!api) throw new Error(`${MINI_PROGRAM_TARGET} Mini Program API unavailable`);
  return api;
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
