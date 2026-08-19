import { pageMetadata } from '../../../../../../../lib/page-meta';

export const generateMetadata = pageMetadata('learn/[orgSlug]/students/[studentId]/messages');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
