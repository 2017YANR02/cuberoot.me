import { pageMetadata } from '@/lib/page-meta';
import AdminShell from './AdminShell';
export const generateMetadata = pageMetadata('admin');
export default function Layout({ children }: { children: React.ReactNode }) { return <AdminShell>{children}</AdminShell>; }
