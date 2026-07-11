// /person/[wcaId] — 选手聚合页(复盘 / WCA 档案 / 社区入口)。纯客户端壳,数据全在
// 浏览器拉,服务端渲染的壳对每个 wcaId 都一样。wcaId 空间无界(~20万选手)且 Vercel
// 每次部署重置 ISR 缓存,老的 dynamicParams=true 模型会在爬虫 / 部署后扫全量时按未见过的
// id 逐个现跑 Function(Function Invocations spike)。改成预生成 ONE 静态哨兵壳 "_",经
// next.config rewrite 把每个真 id 路由过来,客户端从 window.location 读真 id。零 per-id
// 函数调用,扛得住部署重置。同 wca/persons/[wcaId] / wca/comp/[slug]。
import PersonHubClient from './PersonHubClient';

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ wcaId: '_' }];
}

export default function Page() {
  return <PersonHubClient />;
}
