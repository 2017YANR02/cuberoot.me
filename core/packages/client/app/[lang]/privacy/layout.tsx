import { pageMetadata } from '../../../lib/page-meta';

export const generateMetadata = pageMetadata('privacy');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
