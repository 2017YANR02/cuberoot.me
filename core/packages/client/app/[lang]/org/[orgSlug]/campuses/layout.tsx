import { pageMetadata } from '../../../../../lib/page-meta';

export const generateMetadata = pageMetadata('org/[orgSlug]/campuses');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
