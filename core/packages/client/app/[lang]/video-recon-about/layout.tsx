import { pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('video-recon-about');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
