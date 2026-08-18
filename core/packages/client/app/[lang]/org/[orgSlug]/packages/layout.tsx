import { pageMetadata } from '../../../../../lib/page-meta';

export const generateMetadata = pageMetadata('org/[orgSlug]/packages');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
