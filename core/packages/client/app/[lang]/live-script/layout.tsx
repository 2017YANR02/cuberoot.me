import { pageMetadata } from '../../../lib/page-meta';

export const generateMetadata = pageMetadata('live-script');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
