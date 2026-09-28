import { pageMetadata } from '@/lib/page-meta';
const getMetadata = pageMetadata('admin/interview');
export async function generateMetadata(props: Parameters<typeof getMetadata>[0]) {
  return { ...await getMetadata(props), robots: { index: false, follow: false } };
}
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
