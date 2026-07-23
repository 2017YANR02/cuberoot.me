'use client';

// 在微信内配置**本页**的分享卡片(会话 + 朋友圈)。给需要富化卡片(自定义描述 / 专属图)
// 的页面用 —— 传随语言 / 数据变化的 title/desc/imgUrl。pathname 变化(SPA 导航)时重配。
// 非微信环境零副作用。站点级默认(用 document.title 兜底)见 components/WeChatShareSync。

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { configureWeChatShare, isInWeChat, type WeChatShareData } from '@/lib/wechat-share';

export function useWeChatShare(data: WeChatShareData | null | undefined): void {
  const pathname = usePathname();
  const title = data?.title ?? '';
  const desc = data?.desc ?? '';
  const imgUrl = data?.imgUrl ?? '';
  const link = data?.link ?? '';
  useEffect(() => {
    if (!isInWeChat() || !title) return;
    // 轻微延后:让 useDocumentTitle / 数据加载先落定;SPA 导航后 URL 已变,用当前 href 重新签名。
    const t = setTimeout(() => { void configureWeChatShare({ title, desc, imgUrl, link }); }, 60);
    return () => clearTimeout(t);
  }, [pathname, title, desc, imgUrl, link]);
}
