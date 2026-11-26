import { pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('math/cubing-lean/short-solutions');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
