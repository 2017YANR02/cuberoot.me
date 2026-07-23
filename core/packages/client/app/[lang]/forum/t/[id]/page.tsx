// /forum/t/[id] — thread view. ISR + per-thread social-share metadata so a
// shared link renders as a rich card (title + first-post excerpt), not a bare
// text link. Mirrors the recon detail page: dynamicParams open to all ids,
// generateStaticParams prebuilds none (per-id function renders are bounded by
// forum size and cached by `revalidate`). The real id reaches this page — the
// sentinel rewrite for /forum/t was removed in next.config so generateMetadata
// can fetch the actual thread; the client still reads the id from window.location.
//
// robots stays noindex (existing forum policy — sharing cards are independent of
// SEO indexing; WeChat / OG crawlers ignore robots for card generation).
//
// Locale strings are picked from {en,zh} lookup objects via pick(lang) (this is a
// server module — the client tr() pipeline isn't available; same discipline as
// lib/recon-seo.ts, keyed off the [lang] route param).
import type { Metadata } from 'next';
import ThreadClient from './ThreadClient';
import { fetchThreadForSeo } from '@/lib/forum-seo';

export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

type Bi = { en: string; zh: string };
function pick(l: Bi, lang: string): string {
  return lang.startsWith('zh') ? l.zh : l.en;
}
const FALLBACK: Bi = { en: 'Forum | CubeRoot', zh: '论坛 | CubeRoot' };
const DISCUSS: Bi = { en: 'discussion', zh: '讨论' };
const LANG_PREFIX: Bi = { en: '', zh: '/zh' };

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const numeric = /^\d+$/.test(id) ? id : ''; // '_' sentinel / junk → no fetch
  const seo = numeric ? await fetchThreadForSeo(numeric, lang.startsWith('zh')) : null;

  if (!seo) {
    return {
      title: pick(FALLBACK, lang),
      robots: { index: false, follow: true },
    };
  }

  const canonical = `https://cuberoot.me${pick(LANG_PREFIX, lang)}/forum/t/${numeric}`;
  const forumDesc = seo.forumName ? `${seo.forumName} ${pick(DISCUSS, lang)}` : '';
  const description = seo.excerpt || forumDesc;
  return {
    title: `${seo.title} | CubeRoot`,
    description,
    alternates: { canonical },
    robots: { index: false, follow: true },
    // Per-segment openGraph replaces the site default, so re-include images.
    openGraph: { title: seo.title, description, url: canonical, type: 'article', images: ['/icons/CubeRoot.png'] },
  };
}

export default function Page() {
  return <ThreadClient />;
}
