import { pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('partnership/talking-points');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
