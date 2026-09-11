import { metadataFromEntry } from '@/lib/page-meta';
export const metadata = { ...metadataFromEntry({ title: { en: 'Page access', zh: '页面访问' } }, 'en'), robots: { index: false, follow: false } };
export default function Layout({ children }: { children: React.ReactNode }) { return children; }
