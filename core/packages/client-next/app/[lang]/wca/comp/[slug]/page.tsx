// Server wrapper for /wca/comp/[slug]. 17k comps — defer SSG entirely, render on-demand.
// `dynamic = 'force-dynamic'` required on Vercel runtime: Next 16's prod build
// tries to server-render the wrapper for streaming, hits useSearchParams() inside
// CompDetailPage before the Suspense fallback kicks in, throws
// DYNAMIC_SERVER_USAGE → 500. Suspense alone wasn't enough.
import { Suspense } from 'react';
import CompDetailPage from './CompDetailPage';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CompDetailPage />
    </Suspense>
  );
}
