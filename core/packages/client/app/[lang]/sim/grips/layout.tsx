import { pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('sim/grips');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
