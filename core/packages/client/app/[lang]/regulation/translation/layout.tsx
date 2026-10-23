import { pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('regulation/translation');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
