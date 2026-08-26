import { pageMetadata } from '../../../lib/page-meta';

export const generateMetadata = pageMetadata('pb');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
