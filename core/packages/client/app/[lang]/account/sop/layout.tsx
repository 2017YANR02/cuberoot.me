import { pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('account/sop');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
