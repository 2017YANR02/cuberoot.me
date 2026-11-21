import IframePage from '@/components/IframePage';
import { PAGE_META } from '@/lib/page-meta';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const title = PAGE_META['video-recon'].title[lang === 'zh' ? 'zh' : 'en'];
  return <IframePage
    src="/vendor/video-recon/"
    title={title}
    allow="camera 'self'; clipboard-write 'self'; cross-origin-isolated 'self'"
    syncDocumentTitle={false}
  />;
}
