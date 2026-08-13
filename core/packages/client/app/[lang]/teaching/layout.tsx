import type { Metadata } from 'next';
import JsonLd, { articleJsonLd, SITE_URL } from '@/components/JsonLd';
import { pageMetadata } from '@/lib/page-meta';

const teachingMetadata = pageMetadata('teaching');

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const metadata = await teachingMetadata({ params });
  const { lang } = await params;
  return lang === 'zh' ? metadata : { ...metadata, robots: { index: false, follow: true } };
}

export default async function Layout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (lang !== 'zh') return children;
  return (
    <>
      <JsonLd
        data={articleJsonLd({
          headline: '儿童三阶魔方课：教学大纲与提词稿',
          description: '面向儿童的三阶魔方录播课方案，包含试听课、层先法和 CFOP 共 38 节课程的时长、拍摄清单与逐节提词稿。',
          url: `${SITE_URL}/zh/teaching`,
          lang,
        })}
      />
      {children}
    </>
  );
}
