// Server wrapper: make this route static instead of SSR-per-request. The actual
// UI is a client shell (WcaStatClient) that reads the statId via useParams() and
// fetches /stats/<statId>.json at runtime in the browser. Valid IDs come from
// the shared route contract. Keep on-demand static generation so builds don't
// depend on the separately published data or fetch metadata for every statistic.
import { notFound } from 'next/navigation';
import { isWcaStatPage } from '@cuberoot/shared/wca-stat-catalog';
import WcaStatClient from './WcaStatClient';

export const dynamic = 'force-static';
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export default async function Page({ params }: { params: Promise<{ statId: string }> }) {
  const { statId } = await params;
  if (!isWcaStatPage(statId)) notFound();
  return <WcaStatClient />;
}
