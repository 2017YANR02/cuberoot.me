import { pageMetadata } from '@/lib/page-meta';
const metadata = pageMetadata('timer/watch');
export async function generateMetadata(props: Parameters<typeof metadata>[0]) {
  return { ...await metadata(props), robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
}
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
