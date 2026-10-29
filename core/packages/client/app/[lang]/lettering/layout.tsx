import { pageMetadata } from '../../../lib/page-meta';

export const generateMetadata = pageMetadata('lettering');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
