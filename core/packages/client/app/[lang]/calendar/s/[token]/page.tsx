// /calendar/s/<token> 的哨兵壳 —— 和 /forum/f/[slug] 同一招:只预渲染一个静态壳,
// 真实 token 由客户端从 window.location 读(next.config 的 beforeFiles rewrite 把所有
// token 都指到这里)。分享链接空间无界,给每个 token 走一次服务端渲染纯属浪费配额。
//
// noindex 是本页的正确取向:公开是「拿到链接的人能看」,不是「进搜索引擎」。
import type { Metadata } from 'next';
import SharedCalendarClient from './SharedCalendarClient';

export const dynamicParams = false;
export const metadata: Metadata = { robots: { index: false, follow: false } };

export function generateStaticParams() {
  return [{ token: '_' }];
}

export default function Page() {
  return <SharedCalendarClient />;
}
