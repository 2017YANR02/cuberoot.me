import { pageMetadata } from '../../../../lib/page-meta';
import '../../org/org.css';

export const generateMetadata = pageMetadata('training/[orgSlug]');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
