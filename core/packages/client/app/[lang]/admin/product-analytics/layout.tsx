import { pageMetadata } from '@/lib/page-meta';
export async function generateMetadata(props: { params: Promise<{ lang: string }> }) {
  return { ...await pageMetadata('admin/product-analytics')(props), robots: { index: false, follow: false } };
}
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
