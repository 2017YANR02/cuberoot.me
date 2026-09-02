import { pageMetadata } from '@/lib/page-meta';
export const generateMetadata = pageMetadata('admin/users');
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
