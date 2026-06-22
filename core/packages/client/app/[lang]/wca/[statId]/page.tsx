// Server wrapper: make this route static instead of SSR-per-request. The actual
// UI is a client shell (WcaStatClient) that reads the statId via useParams() and
// fetches /stats/<statId>.json at runtime in the browser. There is no static,
// server-safe list of valid statIds — the /wca index page itself discovers them
// by fetching /stats/index.json at runtime, and the underlying data lives only
// in the /stats filesystem (not bundled). So we can't enumerate params at build;
// instead emit zero static params + force-static with dynamicParams so any
// statId is served as a static shell that hydrates and fetches its own data.
import { notFound } from 'next/navigation';
import WcaStatClient from './WcaStatClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

// 已退役的 statId(功能迁走、页面删除 / 路由重命名)。命中即 404,避免落到 WcaStatClient 拿不到
// JSON 的「加载失败」壳。
//   name_stats   → 迁到 /wca/results 空态(姓名统计 + A-Z 名录)
//   all-results  → 路由重命名为 /wca/results(原 /wca/all-results 弃用)
const RETIRED_STATS = new Set(['name_stats', 'all-results']);

export default async function Page({ params }: { params: Promise<{ statId: string }> }) {
  const { statId } = await params;
  if (RETIRED_STATS.has(statId)) notFound();
  return <WcaStatClient />;
}
