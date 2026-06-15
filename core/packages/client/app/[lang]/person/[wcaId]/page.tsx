// /person/[wcaId] — 选手聚合页:复盘 / WCA 档案 / 社区文章 三入口。
// 客户端壳(数据全在浏览器拉),wcaId 走 useParams;force-static + 按需。
import PersonHubClient from './PersonHubClient';

export const dynamic = 'force-static';
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export default function Page() {
  return <PersonHubClient />;
}
