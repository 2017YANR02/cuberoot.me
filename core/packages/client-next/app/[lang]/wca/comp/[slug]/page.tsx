// Server wrapper for /wca/comp/[slug]. 17k comps — defer SSG entirely, render on-demand.
// Suspense wraps CompDetailPage because it calls useSearchParams() at the top of
// the tree; without this boundary, Next bails out to CSR with a hard error in prod.
import { Suspense } from 'react';
import CompDetailPage from './CompDetailPage';

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
