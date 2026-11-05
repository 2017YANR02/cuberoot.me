import { pageMetadata } from '@/lib/page-meta';
const archiveMetadata = pageMetadata('tutorial/lbl-archive');
export async function generateMetadata(props: Parameters<typeof archiveMetadata>[0]) {
  return { ...await archiveMetadata(props), robots: { index: false, follow: true } };
}
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
