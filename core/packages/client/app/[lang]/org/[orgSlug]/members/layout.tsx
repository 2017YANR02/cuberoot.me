import { pageMetadata } from '../../../../../lib/page-meta';

export const generateMetadata = pageMetadata('org/[orgSlug]/members');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
