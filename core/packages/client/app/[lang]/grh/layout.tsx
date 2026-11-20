import { pageMetadata } from '@/lib/page-meta';

export const generateMetadata = pageMetadata('grh');
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
