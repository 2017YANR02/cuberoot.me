import { pageMetadata } from '../../../../../../../../../lib/page-meta';

export const generateMetadata = pageMetadata('org/[orgSlug]/training/assignments/[assignmentId]/students/[studentId]');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
