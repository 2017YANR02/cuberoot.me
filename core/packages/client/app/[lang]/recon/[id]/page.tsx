import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReconDetailClient from './ReconDetailClient';
import {
  fetchReconForSeo, fetchSameScrambleForSeo, buildReconTitle, buildReconDescription, reconCanonical,
  isZhLang, buildVideoJsonLd, parseReconId, reconPathSeg,
} from '@/lib/recon-seo';

// ISR: render on first request, then cache for 24h (dynamicParams keeps it open
// to all ids; generateStaticParams() returns none so nothing is prebuilt at
// build — bounded cost across 2375+ growing recons). NEVER force-dynamic
// (crawler-triggered dynamic SSR of client shells previously blew up Vercel CPU).
export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

// Fallback metadata when the recon can't be fetched (404 / API down).
const FALLBACK_TITLE = { en: 'Reconstruction | CubeRoot', zh: '复盘 | CubeRoot' };
// Private recon — generic noindex title (content never reaches SSR).
const PRIVATE_TITLE = { en: 'Private reconstruction | CubeRoot', zh: '私享复盘 | CubeRoot' };

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id: seg } = await params;
  const id = parseReconId(seg);
  const isZh = isZhLang(lang);
  const solve = await fetchReconForSeo(id);

  // 私享:通用标题 + 完全 noindex(内容永不进 SSR HTML)。
  if (solve === 'private') {
    return {
      title: isZh ? PRIVATE_TITLE.zh : PRIVATE_TITLE.en,
      alternates: { canonical: reconCanonical(id, lang) },
      robots: { index: false, follow: false },
    };
  }
  if (!solve) {
    return {
      title: isZh ? FALLBACK_TITLE.zh : FALLBACK_TITLE.en,
      alternates: { canonical: reconCanonical(id, lang) },
      robots: { index: false, follow: true },
    };
  }

  // Canonical points at the keyword-rich slugged URL (consolidates bare-id and
  // any slug variant onto one canonical — Phase 1's consolidation mechanism).
  const canonical = reconCanonical(id, lang, reconPathSeg(solve));
  const title = buildReconTitle(solve, isZh);
  const description = buildReconDescription(solve, isZh);
  // 不公开列出(unlisted)= 有链接可看但不进搜索 → noindex;否则非 WCA / 练习是薄内容也 noindex;
  // 公开的 WCA 复盘才索引。
  const robots = (solve.visibility === 'unlisted' || solve.official !== 'wca')
    ? { index: false, follow: true }
    : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    robots,
    // Next replaces the parent openGraph per segment, so re-include an image or
    // this page's share card loses the site-wide default thumbnail (→ text-only
    // on WeChat). Reuse the brand mark; a per-solve image can replace it later.
    openGraph: { title, description, url: canonical, type: 'article', images: ['/icons/CubeRoot.png'] },
  };
}

export default async function Page({ params }: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id: seg } = await params;
  const id = parseReconId(seg);
  const solve = await fetchReconForSeo(id);

  // 私享:SSR(无 token)拿不到内容,渲染无 initialSolve 的客户端岛 —— 它挂载时用查看者
  // 自己的 token 重新拉 /recon/:id,添加者本人拿得到并渲染,其余人看到「私享」提示。
  // ISR 缓存里因此只有这个空壳门,不泄露任何私享内容。
  if (solve === 'private') {
    return <ReconDetailClient />;
  }
  if (!solve) notFound();

  // SSR the "same scramble" matches so they're in the initial HTML (instant
  // paint); the client island still refreshes them in the background.
  const sameScramble = await fetchSameScrambleForSeo(id);

  const videoJsonLd = buildVideoJsonLd(solve, lang);

  return (
    <>
      {videoJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
        />
      )}
      {/* Title/description/canonical/robots come from generateMetadata; this
          JSON-LD + the client island (which SSRs the full visible recon, incl.
          its own <h1 className="detail-title">) are the indexable body. No hidden
          SEO shadow block — it duplicated content and emitted a second <h1>. */}
      <ReconDetailClient initialSolve={solve} initialSameScramble={sameScramble} />
    </>
  );
}
