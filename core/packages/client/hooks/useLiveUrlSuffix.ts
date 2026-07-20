'use client';

// 当前 URL 的 pathname + search + hash,用于拼「指向当前页」的绝对链接
// (跨 origin 的环境切换、分享链接等,这类 href 没法用 AppLink)。
//
// 为什么不能直接在 render body 里读 window.location:nuqs 默认 shallow 写
// (history.replaceState)只改地址栏,不过 Next 路由 —— usePathname 不会因此
// 重渲染。全局常驻的 chrome(通知条、header 控件)几乎从不重渲染,读到的
// URL 会永远停在挂载那一刻,拼出来的链接丢掉页内状态(?q=... 之类)。
//
// 刷新时机:document 级捕获 pointerdown / focusin。用户激活一个链接之前必然
// 先经过其中之一(左键 / 中键 / Ctrl 点都先发 pointerdown,键盘走 focusin),
// 而 pointerdown 是 discrete event,React 同步 flush —— 所以真 <a> 的 href 在
// 导航发生前必已刷新,中键新开标签页拿到的也是最新 URL。
// 不订阅 popstate/hashchange:那之后用户还是要先交互才能激活链接,冗余。
//
// 快照是字符串,URL 没变时 Object.is 相等 → 不重渲染,监听全局 pointerdown
// 的代价只是每次点击一次字符串拼接。
import { useSyncExternalStore } from 'react';

const CAPTURE = { capture: true } as const;

function subscribe(onChange: () => void): () => void {
  document.addEventListener('pointerdown', onChange, CAPTURE);
  document.addEventListener('focusin', onChange, CAPTURE);
  return () => {
    document.removeEventListener('pointerdown', onChange, CAPTURE);
    document.removeEventListener('focusin', onChange, CAPTURE);
  };
}

const read = (): string =>
  window.location.pathname + window.location.search + window.location.hash;

/** SSR / 首次 hydrate 前返回 ''(此时没有可用的 window.location)。 */
export function useLiveUrlSuffix(): string {
  return useSyncExternalStore(subscribe, read, () => '');
}

export default useLiveUrlSuffix;
