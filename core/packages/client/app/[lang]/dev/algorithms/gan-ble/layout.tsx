import { pageMetadata } from '../../../../../lib/page-meta';

// Server layout so this route's <title>/<description> reach the SERVER HTML —
// page.tsx is a client component and cannot export metadata itself.
// Wording lives in lib/page-meta.ts under the key below.
export const generateMetadata = pageMetadata('dev/algorithms/gan-ble');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
