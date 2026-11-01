import { pageMetadata } from '../../../lib/page-meta';

// Wording lives in lib/page-meta.ts under the key below.
export const generateMetadata = pageMetadata('memo');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
