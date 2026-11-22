import { PAGE_META } from '@/lib/page-meta';
import VideoToolsPage from './VideoToolsPage';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return <VideoToolsPage title={PAGE_META['frame-count'].title[lang === 'zh' ? 'zh' : 'en']} />;
}
