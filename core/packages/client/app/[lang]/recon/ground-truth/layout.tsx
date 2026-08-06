import { pageMetadata } from '../../../../lib/page-meta';

export const generateMetadata = pageMetadata('recon/ground-truth');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
