import JsonLd, { articleJsonLd, SITE_URL } from '@/components/JsonLd';
import { PAGE_META } from '@/lib/page-meta';
import Proofs from './Proofs';

export default async function CubingLeanPage({ params }: { params: Promise<{ lang: string }> }) {
  const revision = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || 'main';
  const { lang } = await params;
  const locale = lang === 'zh' ? 'zh' : 'en';
  const meta = PAGE_META['math/cubing-lean'];
  return <>
    <JsonLd data={articleJsonLd({
      headline: meta.title[locale],
      description: meta.description?.[locale] ?? meta.title[locale],
      url: SITE_URL + { zh: '/zh/math/cubing-lean', en: '/math/cubing-lean' }[locale],
      lang: locale,
    })} />
    <Proofs revision={revision} />
  </>;
}
