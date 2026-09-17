import { pageMetadata } from '@/lib/page-meta';
const routeMetadata = pageMetadata('account/mcp');
export async function generateMetadata(args: Parameters<typeof routeMetadata>[0]) {
  return { ...await routeMetadata(args), robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
}
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
