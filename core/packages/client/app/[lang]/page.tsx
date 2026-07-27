import { pageMetadata, PAGE_META } from '@/lib/page-meta';
import JsonLd, { SITE_URL, SITE_NAME, PUBLISHER } from '@/components/JsonLd';
import LandingClient from './LandingClient';

// The landing page is the ONE route that cannot get its metadata from a sibling
// layout.tsx: at this level that file is app/[lang]/layout.tsx, which wraps every
// route on the site — a title set there would leak onto the handful of routes
// that have no layout of their own (the [param] sentinel shells). So this route
// takes the server-wrapper split instead, and the page body lives in
// LandingClient.tsx unchanged.
export const generateMetadata = pageMetadata('');

export default async function Page({ params }: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const isZh = lang === 'zh';
  // Identity nodes for the site itself. Deliberately NO SearchAction: that
  // property promises a URL template a query can be substituted into, and this
  // site has no global search endpoint (only /forum/search and
  // /scramble/pattern/search, which cover their own sections). Declaring one
  // anyway would be a claim the site cannot honour.
  const graph = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: isZh ? 'zh-Hans' : 'en',
      description: PAGE_META['']?.description?.[isZh ? 'zh' : 'en'],
      publisher: PUBLISHER,
    },
    { '@context': 'https://schema.org', ...PUBLISHER },
  ];
  return (
    <>
      <JsonLd data={graph} />
      <LandingClient />
    </>
  );
}
