import { pageMetadata } from '@/lib/page-meta';

const metadata = pageMetadata('sim/embed');
export const generateMetadata = async (props: Parameters<typeof metadata>[0]) => ({
  ...await metadata(props), robots: { index: false, follow: false },
});
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
