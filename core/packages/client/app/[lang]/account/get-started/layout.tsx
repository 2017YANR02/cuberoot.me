import { pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('account/get-started');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
