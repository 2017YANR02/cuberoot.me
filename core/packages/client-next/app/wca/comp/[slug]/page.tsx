// Server wrapper for /wca/comp/[slug]. 17k comps — defer SSG entirely, render on-demand.
import CompDetailPage from './CompDetailPage';

export const dynamicParams = true;
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

export default function Page() {
  return <CompDetailPage />;
}
