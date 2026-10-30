import { pageMetadata } from '@/lib/page-meta';
const metadata = pageMetadata('account');
export async function generateMetadata(props: Parameters<typeof metadata>[0]) { return { ...await metadata(props), robots: { index: false, follow: false } }; }
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
