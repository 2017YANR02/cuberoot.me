import { pageMetadata } from '@/lib/page-meta';
import WorkspaceNavigation from '../workspace/WorkspaceNavigation';
const title = pageMetadata('admin');
export async function generateMetadata(props: Parameters<typeof title>[0]) { return { ...await title(props), robots: { index: false, follow: false } }; }
export default function Layout({ children }: { children: React.ReactNode }) { return <WorkspaceNavigation>{children}</WorkspaceNavigation>; }
