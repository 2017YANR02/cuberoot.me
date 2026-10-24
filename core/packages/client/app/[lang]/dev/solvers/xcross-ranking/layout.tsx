import { pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('dev/solvers/xcross-ranking');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
