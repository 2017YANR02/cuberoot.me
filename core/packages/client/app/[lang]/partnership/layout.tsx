import { pageMetadata } from '@/lib/page-meta';
import JsonLd, { articleJsonLd } from '@/components/JsonLd';

const getMetadata = pageMetadata('partnership');
export async function generateMetadata(props: Parameters<typeof getMetadata>[0]) {
  return { ...await getMetadata(props), robots: { index: false, follow: true } };
}

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const meta = await getMetadata({ params: Promise.resolve({ lang }) });
  return <><JsonLd data={articleJsonLd({ headline: String(meta.openGraph?.title ?? ''), description: String(meta.description ?? ''), url: `https://cuberoot.me${lang === 'zh' ? '/zh' : ''}/partnership`, lang })} />{children}</>;
}
