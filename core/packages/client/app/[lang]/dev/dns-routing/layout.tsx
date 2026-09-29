import { pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('dev/dns-routing');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
