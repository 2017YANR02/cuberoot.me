'use client';

// ⚠️ 本账号(个人订阅号)永久无法激活微信自定义分享 —— 详见 lib/wechat-share.ts 顶部。留着仅为将来换企业认证服务号。
// 站点级微信分享卡片默认同步。挂在 [lang]/layout,给**每一个页面**一个合理的会话 + 朋友圈
// 卡片:直接取实时的 document.title(各页由 useDocumentTitle 按语言设),故卡片标题天然随页
// 变化 —— 零 SSR 成本,连哨兵壳路由(比赛 / 选手)也覆盖。想要更丰富描述 / 专属图的页面自己
// 调 useWeChatShare(在此之后运行、覆盖之)。非微信环境不加载 SDK、不发任何请求。

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { configureWeChatShare, isInWeChat } from '@/lib/wechat-share';

export default function WeChatShareSync() {
  const pathname = usePathname();
  useEffect(() => {
    if (!isInWeChat()) return;
    let last = '';
    const apply = () => {
      const title = (document.title || 'CubeRoot').trim();
      if (title === last) return; // 去重:同标题不重复签名/配置
      last = title;
      void configureWeChatShare({ title });
    };
    // 首配延后一拍,等本页 useDocumentTitle 落定;再用 MutationObserver 跟随后续标题变化
    // (i18n 切换 / 数据加载后改标题)。
    const t = setTimeout(apply, 150);
    const titleEl = document.querySelector('title');
    const obs = titleEl ? new MutationObserver(apply) : null;
    if (titleEl && obs) obs.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => { clearTimeout(t); obs?.disconnect(); };
  }, [pathname]);
  return null;
}
