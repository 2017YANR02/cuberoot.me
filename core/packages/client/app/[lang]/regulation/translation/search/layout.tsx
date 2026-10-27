import { pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('regulation/translation/search');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
