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

// 已退役的 statId(功能迁走、页面删除)。命中即 404。
//   name_stats → 迁到 /wca/all-results 空态(姓名统计 + A-Z 名录)
const RETIRED_STATS = new Set(['name_stats']);

export default async function Page({ params }: { params: Promise<{ statId: string }> }) {
  const { statId } = await params;
  if (RETIRED_STATS.has(statId)) notFound();
  return <WcaStatClient />;
}
