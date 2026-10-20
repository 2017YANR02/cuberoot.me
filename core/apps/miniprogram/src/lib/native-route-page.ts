import { nativeWebDestination, type NativeWebDestination } from './native-web-destination';
import { queueNativeTimerLink } from './native-timer-link';
import { resolveWebRoute } from './web-routes';
import { miniProgramApi } from './platform';
import { tr } from './i18n';
import { hidePublicShareMenu } from './share';
import { applyNativeAppearance } from './appearance';

function destination(options: Record<string, string | undefined>): NativeWebDestination | null {
  if (options.path !== undefined) {
    let path = options.path;
    try { if (!path.startsWith('/')) path = decodeURIComponent(path); } catch { return null; }
    if (/^\/(?:zh\/|en\/)?account\/?$/.test(path)) return { method: 'redirectTo', url: '/pages/account-settings/index' };
    if (/^\/(?:zh\/|en\/)?account\?view=signin&mini_program=login$/.test(path)) return { method: 'redirectTo', url: '/pages/account-link/index' };
    return nativeWebDestination(path);
  }
  if (['timer', 'tools', 'account'].includes(options.nativeTab ?? '')) {
    return { method: 'switchTab', url: `/pages/${options.nativeTab}/index` };
  }
  if (options.key === 'account') return { method: 'redirectTo', url: '/pages/account-settings/index' };
  if (options.key === 'account-link') return { method: 'redirectTo', url: '/pages/account-link/index' };
  if (options.key === 'logout') return { method: 'switchTab', url: '/pages/account/index' };
  const route = resolveWebRoute(options.key);
  return route ? nativeWebDestination(route.path) : null;
}
export function createNativeRoutePageOptions() {
  return {
    data: { appearanceStyle: '', error: '', retry: tr({ zh: '重试', en: 'Retry' }), canRetry: false },
    target: null as NativeWebDestination | null, attempt: 0, active: false,
    onLoad(options: Record<string, string | undefined>) {
      this.active = true; this.target = destination(options);
      this.navigate();
    },
    onShow() { this.active = true; applyNativeAppearance(); hidePublicShareMenu(); },
    onHide() { this.active = false; ++this.attempt; },
    onUnload() { this.active = false; ++this.attempt; },
    navigate() {
      if (!this.active) return;
      const target = this.target as NativeWebDestination | null;
      if (!target) { this.setData({ error: tr({ zh: '此链接暂不支持，请从小程序内进入相应功能。', en: 'This link is not supported. Open the feature from the Mini Program.' }), canRetry: false }); return; }
      const attempt = ++this.attempt;
      const cancelLink = target.timerLink ? queueNativeTimerLink(target.timerLink) : undefined;
      this.setData({ error: '', canRetry: false });
      const fail = () => {
        cancelLink?.();
        if (!this.active || this.attempt !== attempt) return;
        this.setData({ error: tr({ zh: '页面暂时无法打开，请重试。', en: 'Could not open the page. Try again.' }), canRetry: true });
      };
      try { miniProgramApi()[target.method]({ url: target.url, fail }); } catch { fail(); }
    },
  } satisfies WechatMiniprogram.Page.Options<{
    appearanceStyle: string; error: string; retry: string; canRetry: boolean;
  }, WechatMiniprogram.Page.CustomOption>;
}
