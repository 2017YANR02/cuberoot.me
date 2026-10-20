import { pageMetadata } from '@/lib/page-meta';
const title = pageMetadata('workspace');
export async function generateMetadata(props: Parameters<typeof title>[0]) { return { ...await title(props), robots: { index: false, follow: false } }; }
export default function Layout({children}:{children:React.ReactNode}){return children;}
