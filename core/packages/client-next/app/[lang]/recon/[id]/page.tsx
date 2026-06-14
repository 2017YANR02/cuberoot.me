import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReconDetailClient from './ReconDetailClient';
import {
  fetchReconForSeo, buildReconTitle, buildReconDescription, reconCanonical,
  reconTitleParts, eventNameForSeo, isZhLang, seoLabel, buildVideoJsonLd,
  parseReconId, reconPathSeg,
} from '@/lib/recon-seo';
import { localizeCompName } from '@/lib/comp-localize';
import { displayCuberName } from '@/lib/cuber-name-display';

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
  // Non-official (personal/home) solves are thin content → don't index, but follow.
  const robots = solve.official ? undefined : { index: false, follow: true };

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
  const isZh = isZhLang(lang);
  const solve = await fetchReconForSeo(id);
  if (!solve) notFound();

  const { person, event, time, comp } = reconTitleParts(solve, isZh);
  const solutionText = solve.solution || solve.recon || '';
  const scramble = solve.optimalScramble || solve.wcaScramble || '';
  const date = solve.date ? solve.date.slice(0, 10) : '';
  const officialLabel = seoLabel(solve.official ? 'official' : 'nonOfficial', isZh);
  const reconWord = seoLabel('reconWord', isZh);
  const heading = [person, event, time].filter(Boolean).join(' ');
  const h1 = isZh
    ? `${heading}${comp ? ` ${comp}` : ''} ${reconWord}`.trim()
    : `${heading} ${reconWord}${comp ? ` — ${comp}` : ''}`.trim();
  const videoUrls = solve.videoUrl
    ? solve.videoUrl.split('\n').map(u => u.trim()).filter(Boolean)
    : [];
  const videoJsonLd = buildVideoJsonLd(solve, lang);

  return (
    <>
      {videoJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(videoJsonLd) }}
        />
      )}
      {/* Server-rendered SEO content: real HTML present in the server output and
          visible without JS, so crawlers index the recon. Visually offscreen
          (recon-seo-content) + aria-hidden — the interactive client island below
          renders the full UI for users. */}
      <div className="recon-seo-content" aria-hidden="true">
        <h1>{h1}</h1>
        <p>{officialLabel}</p>
        <dl>
          {person && (<><dt>{seoLabel('solver', isZh)}</dt><dd>{displayCuberName(solve.person ?? '', isZh)}</dd></>)}
          {solve.event && (<><dt>{seoLabel('event', isZh)}</dt><dd>{eventNameForSeo(solve.event, isZh)}</dd></>)}
          {comp && (<><dt>{seoLabel('comp', isZh)}</dt><dd>{localizeCompName(solve.compWcaId ?? '', solve.comp ?? '', isZh)}</dd></>)}
          {date && (<><dt>{seoLabel('date', isZh)}</dt><dd>{date}</dd></>)}
          {time && (<><dt>{seoLabel('time', isZh)}</dt><dd>{time}</dd></>)}
          {solve.average != null && (<><dt>{seoLabel('average', isZh)}</dt><dd>{solve.average}</dd></>)}
          {solve.method && (<><dt>{seoLabel('method', isZh)}</dt><dd>{solve.method}</dd></>)}
          {solve.stm != null && (<><dt>STM</dt><dd>{solve.stm}</dd></>)}
          {solve.tps != null && (<><dt>TPS</dt><dd>{solve.tps}</dd></>)}
        </dl>
        {scramble && (<p><strong>{seoLabel('scramble', isZh)}</strong>: {scramble}</p>)}
        {solutionText && (
          <>
            <p><strong>{seoLabel('solution', isZh)}</strong>:</p>
            <pre>{solutionText}</pre>
          </>
        )}
        {videoUrls.length > 0 && (
          <p>
            {videoUrls.map((u, i) => (
              <a key={i} href={u} rel="noopener noreferrer">{u}</a>
            ))}
          </p>
        )}
      </div>
      <ReconDetailClient initialSolve={solve} />
    </>
  );
}
