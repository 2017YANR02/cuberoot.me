// /recon/person/[wcaId] — 个人复盘主页。纯客户端壳,数据全在浏览器拉,服务端渲染的壳对
// 每个 wcaId 都一样。wcaId 空间无界(~20万选手)且 Vercel 每次部署重置 ISR 缓存,老的
// dynamicParams=true 模型会在爬虫 / 部署后扫全量时按未见过的 id 逐个现跑 Function
// (Function Invocations spike)。改成预生成 ONE 静态哨兵壳 "_",经 next.config rewrite
// 把每个真 id 路由过来,客户端从 window.location 读真 id。同 wca/persons/[wcaId] /
// person/[wcaId] / wca/comp/[slug]。
import ReconPersonClient from './ReconPersonClient';

export const dynamicParams = false;
export function generateStaticParams() {
  return [{ wcaId: '_' }];
}

export default function Page() {
  return <ReconPersonClient />;
}
