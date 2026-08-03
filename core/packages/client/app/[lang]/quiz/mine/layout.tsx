import { pageMetadata } from '../../../../lib/page-meta';

// Server layout so this route's <title>/<description> reach the SERVER HTML —
// page.tsx is a client component and cannot export metadata itself.
export const generateMetadata = pageMetadata('quiz/mine');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
