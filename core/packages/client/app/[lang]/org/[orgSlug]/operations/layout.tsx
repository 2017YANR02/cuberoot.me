import { pageMetadata } from '../../../../../lib/page-meta';

export const generateMetadata = pageMetadata('org/[orgSlug]/operations');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
