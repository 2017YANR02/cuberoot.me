/**
 * Capacitor 原生 app 测试命令通道。
 *
 * CI smoke test 在 iOS Simulator 里没法发硬件输入(swipe / tap / scroll),
 * 用 `xcrun simctl openurl booted "me.cuberoot.app://test?cmd=..."` 把命令喂进 app,
 * 走 deep link → appUrlOpen → 这里 dispatch → 直接改 SPA 状态。
 *
 * 支持命令(`cmd` query 参数):
 *   - `navigate:/path[?query]`  React Router 跳路由
 *   - `scroll:#selector` 或 `scroll:<px>`  滚到锚点或 px 位置
 *   - `theme:dark` / `theme:light` / `theme:system`  切主题
 *
 * 安全:scheme 已在 Android intent filter + iOS Info.plist 注册给本 app,只有同 app 能投递。
 * 但 prod 也允许跑(命令本身无害,改的都是浏览器侧可见状态),如要更严格可加 gate。
 */
import { applyTheme, THEME_KEY, type Theme } from './theme';

export async function installTestCommandHandler(): Promise<void> {
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return;
  const { App } = await import('@capacitor/app');

  await App.addListener('appUrlOpen', ({ url }) => {
    if (!url.startsWith('me.cuberoot.app://test')) return;
    try {
      // url = me.cuberoot.app://test?cmd=navigate:/recon
      const qIdx = url.indexOf('?');
      if (qIdx < 0) return;
      const params = new URLSearchParams(url.slice(qIdx + 1));
      const cmd = params.get('cmd');
      if (cmd) dispatch(cmd);
    } catch { /* ignore */ }
  });
}

function dispatch(cmd: string): void {
  const colon = cmd.indexOf(':');
  const action = colon < 0 ? cmd : cmd.slice(0, colon);
  const arg = colon < 0 ? '' : cmd.slice(colon + 1);

  switch (action) {
    case 'navigate':
      // 用 pushState + popstate 触发 React Router,避开 webview 文件路径 404
      window.history.pushState(null, '', arg || '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
      break;

    case 'scroll':
      if (/^\d+$/.test(arg)) {
        window.scrollTo({ top: Number(arg), behavior: 'auto' });
      } else if (arg) {
        const el = document.querySelector(arg);
        if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
      break;

    case 'theme': {
      const t = arg as Theme;
      if (t === 'light' || t === 'dark' || t === 'system') {
        try { localStorage.setItem(THEME_KEY, t); } catch { /* ignore */ }
        applyTheme(t);
      }
      break;
    }
  }
}
