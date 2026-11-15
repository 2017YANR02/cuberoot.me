import { pageMetadata } from '@/lib/page-meta';
export const generateMetadata = pageMetadata('lucky-draw');
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
