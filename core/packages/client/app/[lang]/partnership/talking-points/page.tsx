import { permanentRedirect } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  permanentRedirect(`${lang === 'zh' ? '/zh' : ''}/bp/talking-points`);
}
