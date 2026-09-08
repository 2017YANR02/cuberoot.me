import { pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('math/navier-stokes');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
