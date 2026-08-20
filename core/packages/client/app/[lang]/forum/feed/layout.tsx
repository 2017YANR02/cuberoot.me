import { pageMetadata } from '../../../../lib/page-meta';

export const generateMetadata = pageMetadata('forum/feed');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
