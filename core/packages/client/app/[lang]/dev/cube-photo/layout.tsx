import { pageMetadata } from '../../../../lib/page-meta';

const metadata = pageMetadata('dev/cube-photo');
export const generateMetadata: typeof metadata = async props => ({
  ...await metadata(props), robots: { index: false, follow: false },
});
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
