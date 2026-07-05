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

export async function generateMetadata({ params }: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id: seg } = await params;
  const id = parseReconId(seg);
  const isZh = isZhLang(lang);
  const solve = await fetchReconForSeo(id);

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
  // Non-WCA / practice solves are thin content → don't index, but follow.
  const robots = solve.official === 'wca' ? undefined : { index: false, follow: true };

  return {
    title,
    description,
    alternates: { canonical },
    robots,
    openGraph: { title, description, url: canonical, type: 'article' },
  };
}

export default async function Page({ params }: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id: seg } = await params;
  const id = parseReconId(seg);
  const solve = await fetchReconForSeo(id);
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
