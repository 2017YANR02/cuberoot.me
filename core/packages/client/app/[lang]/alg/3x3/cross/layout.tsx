import { pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('alg/3x3/cross');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
