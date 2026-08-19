import { pageMetadata } from '../../../../../../../../lib/page-meta';

export const generateMetadata = pageMetadata('org/[orgSlug]/students/[studentId]/messages/[conversationId]');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
