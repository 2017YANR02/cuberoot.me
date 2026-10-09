'use client';

// ⚠️ 本账号(个人订阅号)永久无法激活微信自定义分享 —— 详见 lib/wechat-share.ts 顶部。留着仅为将来换企业认证服务号。
// 站点级微信分享卡片默认同步。挂在 [lang]/layout,给**每一个页面**一个合理的会话 + 朋友圈
// 卡片:取实时的 document.title(各页由 useDocumentTitle 按语言设),再为分享单独补回品牌,
// 故浏览器 tab 保持紧凑、分享标题仍能识别站点。想要更丰富描述 / 专属图的页面自己
// 调 useWeChatShare(在此之后运行、覆盖之)。非微信环境不加载 SDK、不发任何请求。

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { configureWeChatShare, isInWeChat } from '@/lib/wechat-share';
import { syncMiniProgramPageShare } from '@/lib/page-share';
import { miniProgramTab, openMiniProgramTab, mayUseMiniProgramBridge } from '@/lib/miniprogram-bridge';

export default function WeChatShareSync() {
  const pathname = usePathname();
  const lastTimerUrl = useRef<string | null>(null);
  useEffect(() => {
    const tab = miniProgramTab();
    if (!tab || !mayUseMiniProgramBridge()) return;
    const isTimer = (path: string) => /^\/(?:zh\/|en\/)?timer\/?$/.test(path);
    if (tab === 'timer' && isTimer(location.pathname)) lastTimerUrl.current = `${location.pathname}${location.search}${location.hash}`;
    const destinationTab = (path: string) => isTimer(path) ? 'timer' : 'tools';
    const intercept = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const link = (event.target as Element)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement) || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith('/auth/')) return;
      const nativeTarget = link.dataset.miniProgramTarget;
      const target = nativeTarget === 'account' ? 'account' : destinationTab(url.pathname);
      if (target === tab || (tab === 'web' && target !== 'timer')) return;
      event.preventDefault();
      event.stopPropagation();
      void openMiniProgramTab(target, target === 'account' ? undefined : `${url.pathname}${url.search}${url.hash}`).then(handled => {
        if (!handled) location.assign(url.href);
      });
    };
    document.addEventListener('click', intercept, true);
    // Also cover imperative router navigation (for example a pet action).
    if (tab === 'timer' && !isTimer(location.pathname)) {
      const destination = `${location.pathname}${location.search}${location.hash}`;
      void openMiniProgramTab('tools', destination).then(handled => {
        if (handled) location.replace(lastTimerUrl.current ?? (location.pathname.startsWith('/zh/') ? '/zh/timer' : '/timer'));
      });
    }
    return () => document.removeEventListener('click', intercept, true);
  }, [pathname]);
  useEffect(() => {
    if (!isInWeChat() && !mayUseMiniProgramBridge()) return;
    let last = '';
    const apply = () => {
      void syncMiniProgramPageShare();
      const pageTitle = (document.title || 'CubeRoot').trim();
      const title = pageTitle === 'CubeRoot' ? pageTitle : `CubeRoot — ${pageTitle}`;
      if (title === last) return; // 去重:同标题不重复签名/配置
      last = title;
      if (isInWeChat()) void configureWeChatShare({ title });
    };
    // 首配延后一拍,等本页 useDocumentTitle 落定;再用 MutationObserver 跟随后续标题变化
    // (i18n 切换 / 数据加载后改标题)。
    const t = setTimeout(apply, 150);
    const titleEl = document.querySelector('title');
    const obs = titleEl ? new MutationObserver(apply) : null;
    if (titleEl && obs) obs.observe(titleEl, { childList: true, characterData: true, subtree: true });
    window.addEventListener('hashchange', apply);
    return () => {
      clearTimeout(t); obs?.disconnect();
      window.removeEventListener('hashchange', apply);
    };
  }, [pathname]);
  return null;
}
