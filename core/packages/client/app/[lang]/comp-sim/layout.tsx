import { pageMetadata } from '../../../lib/page-meta';

export const generateMetadata = pageMetadata('comp-sim');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
