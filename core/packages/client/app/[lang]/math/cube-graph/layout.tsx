import { pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('math/cube-graph');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
