// Per-item share card (og:title/description specific to this comp, like recon/forum
// have) was evaluated 2026-07-23 and SHELVED for ROI, not rejected — full plan + the
// beforeFiles/afterFiles rewrite trap it must navigate are written up, don't re-derive
// from scratch: see memory project_social_share_cards (or ask the user for that doc).
//
// Server wrapper for /wca/comp/[slug]. CompDetailPage is 'use client' and loads ALL
// data client-side (fetch + WebSocket), so the server render produces only the empty
// <Suspense fallback={null}> shell — identical for every slug.
//
// The slug space is unbounded (~17k comps) and Vercel resets the ISR cache on every
// deploy, so the old dynamicParams=true model re-rendered a Function per first-seen
// slug on every crawler / post-deploy sweep (the Function Invocations spike). Instead
// prerender ONE static shell at the sentinel param "_" and route every real slug to it
// via a next.config rewrite (/:lang/wca/comp/:slug -> .../comp/_). The client
// (CompDetailPage) reads the real slug from window.location. Zero per-slug function
// invocations, survives the per-deployment ISR cache reset. Same trick as
// wca/persons/[wcaId], memo/colpi/[pair], recon/submit/[editId], forum/*.
import { Suspense } from 'react';
import CompDetailPage from './CompDetailPage';

export const dynamicParams = false;
export function generateStaticParams(): { slug: string }[] {
  return [{ slug: '_' }];
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CompDetailPage />
    </Suspense>
  );
}
