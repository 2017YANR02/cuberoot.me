import { pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('dev/team');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
